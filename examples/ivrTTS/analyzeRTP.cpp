// Standalone PCAP/G.711 diagnostics. No packet-capture or scripting dependencies.
#include <algorithm>
#include <cstdint>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <tuple>
#include <vector>
namespace {
using Bytes = std::vector<uint8_t>;
uint32_t number(const Bytes& b, size_t at, unsigned n, bool little = false) {
    if (at > b.size() || n > b.size()-at) throw std::runtime_error("truncated packet");
    uint32_t v=0;
    for (unsigned i=0; i<n; ++i) v=(v<<8)|b[at+(little ? n-1-i : i)];
    return v;
}
void put(std::ostream& out, uint32_t v, unsigned n) {
    for (unsigned i=0; i<n; ++i) out.put(char(v>>(8*i)));
}
std::string quote(const std::string& s) {
    std::ostringstream out; out << '"';
    for (unsigned char c : s) {
        if (c=='"' || c=='\\') out << '\\' << c;
        else if (c<32) out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << unsigned(c) << std::dec;
        else out << c;
    }
    return out.str()+'"';
}
std::string address(const Bytes& b, size_t at) {
    std::ostringstream out;
    for (unsigned i=0; i<4; ++i) { if(i) out << '.'; out << number(b,at+i,1); }
    return out.str();
}
int64_t unwrap(uint32_t value, int64_t reference, unsigned bits) {
    const int64_t modulus=int64_t(1)<<bits;
    int64_t delta=(int64_t(value)-reference)%modulus;
    if(delta < -modulus/2) delta+=modulus;
    if(delta >= modulus/2) delta-=modulus;
    return reference+delta;
}
int16_t decode(uint8_t value, unsigned codec) {
    if(codec==0) {
        value=uint8_t(~value);
        int magnitude=(((value&15)<<3)+132)<<((value>>4)&7);
        return int16_t(value&128 ? 132-magnitude : magnitude-132);
    }
    value^=0x55;
    int magnitude=(value&15)<<4, segment=(value>>4)&7;
    magnitude=segment==0 ? magnitude+8 : (magnitude+264)<<(segment-1);
    return int16_t(value&128 ? magnitude : -magnitude);
}
struct Packet { double time; uint16_t sequence; uint32_t timestamp; unsigned codec; Bytes payload; };
using Key=std::tuple<std::string,uint16_t,std::string,uint16_t,uint32_t>;
using Streams=std::map<Key,std::vector<Packet>>;
Streams read(std::istream& input) {
    auto take=[&](size_t n) { Bytes b(n); if(!input.read(reinterpret_cast<char*>(b.data()),n)) throw std::runtime_error("truncated PCAP"); return b; };
    const auto header=take(24);
    const auto magic=number(header,0,4);
    const bool little=magic==0xd4c3b2a1 || magic==0x4d3cb2a1;
    const bool nano=magic==0x4d3cb2a1 || magic==0xa1b23c4d;
    if(!little && magic!=0xa1b2c3d4 && magic!=0xa1b23c4d) throw std::runtime_error("use tcpdump PCAP, not PCAPNG");
    const auto link=number(header,20,4,little);
    if(link!=1 && link!=101 && link!=113 && link!=276) throw std::runtime_error("unsupported capture link type");
    Streams streams;
    while(input.peek()!=std::char_traits<char>::eof()) {
        const auto record=take(16);
        const auto length=number(record,8,4,little);
        if(length>4*1024*1024) throw std::runtime_error("oversized PCAP record");
        const auto b=take(length);
        size_t ip=link==1 ? 14 : link==101 ? 0 : link==113 ? 16 : 20;
        if(b.size()<ip) continue;
        if(link==1) {
            auto kind=number(b,12,2);
            while(kind==0x8100 || kind==0x88a8) {
                if(b.size()<ip+4) break;
                kind=number(b,ip+2,2); ip+=4;
            }
            if(kind!=0x0800) continue;
        }
        if(b.size()<ip+20 || b[ip]>>4!=4 || b[ip+9]!=17 || (number(b,ip+6,2)&0x3fff)) continue;
        const size_t ihl=(b[ip]&15)*4, total=number(b,ip+2,2), udp=ip+ihl;
        if(ihl<20 || total<ihl+20 || total>b.size()-ip || udp+8>b.size()) continue;
        const size_t size=number(b,udp+4,2), rtp=udp+8;
        if(size<20 || size>total-ihl) continue;
        const auto codec=b[rtp+1]&127;
        if(b[rtp]>>6!=2 || (codec!=0 && codec!=8 && codec!=101) || (b[rtp+1]>=192 && b[rtp+1]<=223)) continue;
        size_t head=rtp+12+(b[rtp]&15)*4, end=udp+size;
        if(head>end) continue;
        if(b[rtp]&16) {
            if(end-head<4) continue;
            head+=4+number(b,head+2,2)*4;
        }
        if(b[rtp]&32) {
            const auto padding=b[end-1];
            if(!padding || padding>end-rtp) continue;
            end-=padding;
        }
        if(head>end) continue;
        Key key{address(b,ip+12),uint16_t(number(b,udp,2)),address(b,ip+16),uint16_t(number(b,udp+2,2)),number(b,rtp+8,4)};
        streams[key].push_back({number(record,0,4,little)+number(record,4,4,little)/(nano ? 1e9 : 1e6),
                               uint16_t(number(b,rtp+2,2)),number(b,rtp+4,4),unsigned(codec),Bytes(b.begin()+head,b.begin()+end)});
    }
    return streams;
}
void write_wav(const std::filesystem::path& path, const std::vector<int16_t>& pcm) {
    std::ofstream out(path,std::ios::binary);
    out.write("RIFF",4); put(out,36+uint32_t(pcm.size()*2),4); out.write("WAVEfmt ",8);
    put(out,16,4); put(out,1,2); put(out,1,2); put(out,8000,4); put(out,16000,4); put(out,2,2); put(out,16,2);
    out.write("data",4); put(out,uint32_t(pcm.size()*2),4);
    for(auto sample:pcm) put(out,uint16_t(sample),2);
    if(!out) throw std::runtime_error("cannot write decoded WAV: "+path.string());
}
std::string analyze(const Streams& streams,const std::filesystem::path& output) {
    std::filesystem::create_directories(output);
    std::ostringstream json; json << std::fixed << std::setprecision(3) << "[";
    unsigned stream_number=0;
    for(const auto& [key, rows]:streams) {
        if(stream_number++) json << ',';
        int64_t reference=rows.front().sequence;
        std::set<int64_t> seen;
        size_t duplicates=0,reordered=0;
        std::vector<const Packet*> audio;
        for(const auto& row:rows) {
            auto sequence=unwrap(row.sequence,reference,16);
            if(seen.count(sequence)) ++duplicates;
            else if(sequence<reference) ++reordered;
            seen.insert(sequence); reference=std::max(reference,sequence);
            if(row.codec==0 || row.codec==8) audio.push_back(&row);
        }
        std::ostringstream ssrc; ssrc << std::hex << std::setw(8) << std::setfill('0') << std::get<4>(key);
        json << "\n  {\"source\": " << quote(std::get<0>(key)+":"+std::to_string(std::get<1>(key)))
             << ", \"destination\": " << quote(std::get<2>(key)+":"+std::to_string(std::get<3>(key)))
             << ", \"ssrc\": " << quote(ssrc.str()) << ", \"packets\": " << rows.size()
             << ", \"sequence_missing\": " << *seen.rbegin()-*seen.begin()+1-int64_t(seen.size())
             << ", \"duplicate_packets\": " << duplicates << ", \"reordered_packets\": " << reordered;
        if(!audio.empty()) {
            double total_gap=0,max_gap=0; size_t long_gaps=0;
            for(size_t i=1;i<audio.size();++i) {
                const double gap=(audio[i]->time-audio[i-1]->time)*1000;
                total_gap+=gap; max_gap=std::max(max_gap,gap); if(gap>40) ++long_gaps;
            }
            std::vector<std::pair<int64_t,const Packet*>> ordered;
            for(const auto* row:audio) ordered.emplace_back(unwrap(row->timestamp,audio.front()->timestamp,32),row);
            std::stable_sort(ordered.begin(),ordered.end(),[](const auto& a,const auto& b){return a.first<b.first;});
            int64_t cursor=ordered.front().first; size_t holes=0;
            std::vector<int16_t> pcm;
            for(const auto& [timestamp,row]:ordered) {
                size_t skip=timestamp<cursor ? size_t(cursor-timestamp) : 0;
                if(skip>=row->payload.size()) continue;
                const auto missing=size_t(std::max<int64_t>(timestamp-cursor,0));
                if(missing>8000*600 || pcm.size()+missing+row->payload.size()-skip>8000*600)
                    throw std::runtime_error("RTP timestamps exceed ten-minute audio limit");
                holes+=missing; pcm.insert(pcm.end(),missing,0);
                for(size_t i=skip;i<row->payload.size();++i) pcm.push_back(decode(row->payload[i],row->codec));
                cursor=timestamp+row->payload.size();
            }
            const auto path=output/("rtp-"+std::to_string(stream_number)+"-"+std::get<0>(key)+"-to-"+std::get<2>(key)+"-"+ssrc.str()+".wav");
            write_wav(path,pcm);
            json << ", \"audio_packets\": " << audio.size() << ", \"mean_gap_ms\": " << (audio.size()>1 ? total_gap/(audio.size()-1) : 0)
                 << ", \"max_gap_ms\": " << max_gap << ", \"gaps_over_40ms\": " << long_gaps
                 << ", \"timestamp_hole_ms\": " << holes/8.0 << ", \"decoded_wav\": " << quote(path.string());
        }
        json << '}';
    }
    json << "\n]\n";
    std::ofstream report(output/"report.json"); report << json.str();
    if(!report) throw std::runtime_error("cannot write report.json");
    return json.str();
}
void self_test() {
    bool rejected=false;
    try { std::istringstream broken("truncated"); (void)read(broken); }
    catch(const std::exception&) { rejected=true; }
    if(!rejected) throw std::runtime_error("truncated PCAP accepted");
    const auto output=std::filesystem::temp_directory_path()/("rtp-test-"+std::to_string(std::chrono::steady_clock::now().time_since_epoch().count()));
    struct Cleanup { std::filesystem::path p; ~Cleanup(){std::filesystem::remove_all(p);} } cleanup{output};
    for(bool little:{false,true}) {
        std::ostringstream capture(std::ios::binary);
        auto integer=[&](uint32_t v,unsigned n){for(unsigned i=0;i<n;++i) capture.put(char(v>>(8*(little?i:n-1-i))));};
        integer(0xa1b2c3d4,4); integer(2,2); integer(4,2); integer(0,4); integer(0,4); integer(65535,4); integer(1,4);
        for(unsigned i=0;i<4;++i) {
            const unsigned sequences[]={65534,65535,1,65535}, micros[]={0,20000,65000,66000}, offsets[]={0,160,480,160};
            Bytes packet(14+20+8+12+160,0);
            auto set=[&](size_t at,uint32_t v,unsigned n){for(unsigned j=0;j<n;++j) packet[at+j]=uint8_t(v>>(8*(n-1-j)));};
            set(12,0x800,2); packet[14]=0x45; set(16,packet.size()-14,2); packet[23]=17;
            set(26,0xc0a80275,4); set(30,0xafb45a21,4); set(34,49192,2); set(36,62318,2); set(38,180,2);
            packet[42]=128; set(44,sequences[i],2); set(46,uint32_t(0xffffff00u+offsets[i]),4); set(50,123,4);
            std::fill(packet.begin()+54,packet.end(),i==1 || i==3 ? 128 : 255);
            integer(1000,4); integer(micros[i],4); integer(packet.size(),4); integer(packet.size(),4);
            capture.write(reinterpret_cast<const char*>(packet.data()),packet.size());
        }
        std::istringstream input(capture.str(),std::ios::binary);
        auto streams=read(input); const auto report=analyze(streams,output);
        if(streams.size()!=1 || report.find("\"sequence_missing\": 1")==std::string::npos ||
           report.find("\"duplicate_packets\": 1")==std::string::npos || report.find("\"max_gap_ms\": 45.000")==std::string::npos ||
           report.find("\"timestamp_hole_ms\": 20.000")==std::string::npos)
            throw std::runtime_error("PCAP/RTP statistics self-test failed");
        const auto path=output/"rtp-1-192.168.2.117-to-175.180.90.33-0000007b.wav";
        std::ifstream wav(path,std::ios::binary); Bytes bytes((std::istreambuf_iterator<char>(wav)),{});
        if(bytes.size()!=44+640*2 || number(bytes,24,4,true)!=8000 || number(bytes,44+160*2,2,true)!=32124 ||
           number(bytes,44+320*2,2,true)!=0 || decode(0,0)!=-32124 || decode(0xd5,8)!=8)
            throw std::runtime_error("G.711 WAV self-test failed");
    }
    std::cout << "PASS: PCAP byte orders, RTP wrap/loss/duplicates/gaps and G.711 WAV reconstruction\n";
}
}
int main(int argc,char** argv) {
    try {
        if(argc==2 && std::string(argv[1])=="--self-test") { self_test(); return 0; }
        if(argc!=2 && !(argc==4 && std::string(argv[2])=="--output"))
            throw std::runtime_error("usage: analyzeRTP CAPTURE.pcap [--output DIRECTORY]");
        std::ifstream input(argv[1],std::ios::binary);
        if(!input) throw std::runtime_error("cannot open capture");
        std::cout << analyze(read(input),argc==4 ? argv[3] : "evidence-rtp");
    } catch(const std::exception& e) {std::cerr << "Error: " << e.what() << '\n'; return 1;}
}
