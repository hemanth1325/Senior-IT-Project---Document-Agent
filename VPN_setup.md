# Problem:
In the current implementation, all services are connected through a public reverse proxy using DuckDNS subdomains. This is convenient, but it creates a security risk because admin services like Langflow and Portainer can become reachable from the public internet.

In the improved architecture, we separate the system into two zones: a public zone and a private VPN zone. The public zone exposes only the BookStack login page through Caddy. The private VPN zone contains Langflow, Portainer, Ollama, ChromaDB, and database services. These services are not exposed through public DuckDNS domains and can only be accessed by authorized devices connected to the VPN.

This architecture improves security because users can access the knowledge portal normally, while developers and administrators must connect through VPN before managing backend services.



High-Level Architecture

                              Internet
                                  │
                    mdhbookstack.duckdns.org
                                  │
                        ┌─────────▼─────────┐
                        │       Caddy       │
                        │ Reverse Proxy +   │
                        │ SSL (HTTPS)       │
                        └─────────┬─────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              │                                       │
      Public Services                        VPN Protected Services
              │                                       │
      ┌───────▼────────┐                     ┌────────▼────────┐
      │   BookStack    │                     │    WireGuard    │
      │ Documentation  │                     │       VPN       │
      └───────┬────────┘                     └────────┬────────┘
              │                                       │
              │                               VPN Authenticated Users
              │                                       │
              │                     ┌─────────────────┼─────────────────┐
              │                     │                 │                 │
              │              ┌──────▼─────┐   ┌──────▼─────┐   ┌──────▼─────┐
              │              │ LangFlow   │   │ Portainer  │   │ Monitoring │
              │              │ AI Workflows│   │ Docker Mgmt│   │ (Optional) │
              │              └──────┬─────┘   └────────────┘   └────────────┘
              │                     │
              │                     │
              │              ┌──────▼─────┐
              │              │   Ollama   │
              │              │ Local LLM  │
              │              └──────┬─────┘
              │                     │
      ┌───────▼────────┐     ┌──────▼─────┐
      │    MariaDB     │     │ PostgreSQL │
      │  BookStack DB  │     │ LangFlow DB│
      └────────────────┘     └────────────┘




Docker Network Architecture

                    Docker Host
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        │                  │                  │
   caddy network      bookstack-net      langflow-net
        │                  │                  │
        │                  │                  │
     Caddy ──────► BookStack          LangFlow
        │               │                 │
        │            MariaDB         PostgreSQL
        │
        │
   private-net
        │
        ├── WireGuard
        ├── LangFlow
        ├── Portainer
        └── Ollama

