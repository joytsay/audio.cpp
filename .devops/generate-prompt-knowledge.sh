#!/usr/bin/env bash
set -euo pipefail

prompt_file=${1:?Usage: generate-prompt-knowledge.sh prompt.csv output-directory}
corpus_dir=${2:?Usage: generate-prompt-knowledge.sh prompt.csv output-directory}
[[ -s "$prompt_file" ]] || { echo "Prompt file is missing or empty: $prompt_file" >&2; exit 1; }
mkdir -p "$corpus_dir"
# Only replace artifacts owned by this generator.
rm -f "$corpus_dir"/section-[0-9]*.md "$corpus_dir"/contact-[0-9]*.md "$corpus_dir"/overview.md
awk -v out="$corpus_dir" '
BEGIN {
    section = 0; contact = 0
    overview = out "/overview.md"
    print "# 台積電客服櫃台知識導覽\n\n來源：prompt.csv。部門與公開聯絡方式、轉接規則與客服對話方式共用同一份來源。\n" > overview
    filename = sprintf("section-%02d.md", section)
    file = out "/" filename
    print "# 台積電客服櫃台角色\n\n來源：prompt.csv。\n" > file
    print "- [台積電客服櫃台角色](" filename ")" >> overview
}
/^# / {
    section++
    title = substr($0, 3)
    filename = sprintf("section-%02d.md", section)
    file = out "/" filename
    print "# 台積電客服櫃台：" title "\n\n來源：prompt.csv。\n" > file
    print "- [" title "](" filename ")" >> overview
    next
}
{
    print $0 >> file
    if ($0 ~ /^\|/ && $0 !~ /^\| ---/ && $0 !~ /^\| 需求/) {
        count = split($0, fields, "|")
        if (count >= 5) {
            contact++
            for (i=2; i<=4; i++) gsub(/^[ \t]+|[ \t]+$/, "", fields[i])
            contactname = sprintf("contact-%02d.md", contact)
            contactfile = out "/" contactname
            print "# 台積電聯絡窗口：" fields[2] "\n\n來源：prompt.csv。\n" > contactfile
            print "窗口 / 需求：" fields[2] "\n公開電話：" fields[3] "\n公開分機：" fields[4] >> contactfile
            print "\n公開電話不等於內部分機。未公開的分機不可編造。電話與分機只適用於這個窗口；中國業務發展處的分機不適用於台灣總機。" >> contactfile
            print "\n[全部公開聯絡窗口](" filename ") · [客服導覽](overview.md)" >> contactfile
            print "- [" fields[2] "](" contactname ")" >> overview
        }
    }
}
END {
    for (i=0; i<=section; i++) {
        f = out "/" sprintf("section-%02d.md", i)
        print "\n[客服導覽](overview.md)" >> f
    }
}
' "$prompt_file"
