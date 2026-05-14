# Hemanth
Today, I worked on building an AI workflow using Langflow. In this session, I created a basic Retrieval-Augmented Generation (RAG) system to understand how AI can retrieve information from external data and generate meaningful responses. For the implementation, I used ChromaDB as the vector database and integrated LiteLLM for handling model interactions and response generation.

The workflow included components such as a URL parser, a prompt template, and a simple URL-based data ingestion pipeline. The scraped web content was processed, converted into embeddings, and stored inside ChromaDB for retrieval. After retrieving the relevant context, LiteLLM was used to generate responses based on the retrieved information. This helped me understand how different components in a RAG pipeline work together.

As a practical use case, I tested the system using content from the Malmö University (MDH) website. The goal was to answer the question, “Where is MDH located?” The system successfully scraped the website content, retrieved the relevant information, and generated an accurate response. Through this task, I gained practical experience in building AI workflows, vector database integration, and implementing a basic question-answering system using Langflow.


# vaman 

Today, I worked on building an AI workflow using Langflow. In this session, I created a basic Retrieval-Augmented Generation (RAG) system.

For the implementation, I used ChromaDB as the vector database and integrated LiteLLM for handling model interactions. I also configured a simple URL-based data ingestion pipeline.

The workflow included components such as a URL parser, a prompt template, and LiteLLM integration to process and generate responses.

As a practical use case, I tested the system by scraping information from the MDH website. The goal was to retrieve and answer the question: “Where is MDH located?” The system successfully processed the web content and generated a relevant response based on the retrieved data.



# Darshak
Today, I worked on building a basic RAG (Retrieval-Augmented Generation) system using Langflow. I used ChromaDB for storing embeddings and LiteLLM for generating responses. The workflow included URL parsing, web scraping, embedding generation, and data retrieval.

As a test case, I used content from the Media Design University website to answer questions like “Where is MDH located?” and “Who is the CEO of MDH?”. This project helped me understand how RAG pipelines, vector databases, and AI workflows work together.
