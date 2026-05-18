# vaman 

Today, I worked on building an AI workflow using Langflow. In this session, I created a basic Retrieval-Augmented Generation (RAG) system.

For the implementation, I used ChromaDB as the vector database and integrated LiteLLM for handling model interactions. I also configured a simple URL-based data ingestion pipeline.

The workflow included components such as a URL parser, a prompt template, and LiteLLM integration to process and generate responses.

As a practical use case, I tested the system by scraping information from the MDH website. The goal was to retrieve and answer the question: “Where is MDH located?” The system successfully processed the web content and generated a relevant response based on the retrieved data.

