# Problem:
In the current implementation, all services are connected through a public reverse proxy using DuckDNS subdomains. This is convenient, but it creates a security risk because admin services like Langflow and Portainer can become reachable from the public internet.

In the improved architecture, we separate the system into two zones: a public zone and a private VPN zone. The public zone exposes only the BookStack login page through Caddy. The private VPN zone contains Langflow, Portainer, Ollama, ChromaDB, and database services. These services are not exposed through public DuckDNS domains and can only be accessed by authorized devices connected to the VPN.

This architecture improves security because users can access the knowledge portal normally, while developers and administrators must connect through VPN before managing backend services.

