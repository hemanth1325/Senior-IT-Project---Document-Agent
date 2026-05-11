### Project Architecture

```text
Docker Network: bookstack-net
├── bookstack
│   ├── Documentation UI
│   ├── Staff Knowledge Upload
│   └── Internal Wiki System
├── db (MariaDB)
│   ├── User Data
│   ├── Page Data
│   └── Metadata Storage
├── ollama
│   ├── Local LLM Hosting
│   ├── Llama3/Mistral Models
│   └── AI Inference Engine
└── ragflow (Future Integration)
    ├── Retrieval-Augmented Generation
    ├── Embeddings
    ├── Semantic Search
    └── Citation Generation
```
