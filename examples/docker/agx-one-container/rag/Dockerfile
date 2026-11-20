FROM debian:bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends g++ libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY include/engine/framework/io/ include/engine/framework/io/
COPY src/framework/io/json.cpp src/framework/io/filesystem.cpp src/framework/io/
COPY external/cJSON/cJSON.* external/cJSON/
COPY external/cpp-httplib/httplib.h external/cpp-httplib/httplib.cpp external/cpp-httplib/
COPY examples/docker/agx-one-container/rag/main.cpp .
RUN gcc -O2 -c external/cJSON/cJSON.c -o /tmp/cjson.o && \
    g++ -std=c++17 -O2 -pthread -Iinclude -Iexternal/cJSON -Iexternal/cpp-httplib \
    main.cpp external/cpp-httplib/httplib.cpp src/framework/io/json.cpp src/framework/io/filesystem.cpp /tmp/cjson.o -lcrypto -o /usr/local/bin/ivr-rag

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libssl3 && rm -rf /var/lib/apt/lists/* && \
    mkdir /vector-cache && chown 65534:65534 /vector-cache
COPY --from=build /usr/local/bin/ivr-rag /usr/local/bin/ivr-rag
USER 65534:65534
EXPOSE 8086
CMD ["ivr-rag"]
