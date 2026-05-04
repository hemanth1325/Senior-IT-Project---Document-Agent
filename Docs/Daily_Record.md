git : Brushing Up the Git commands, 
Docker and Docker compose
langraph, langflow and n8n

Docker Exploring 


Date :28-04-2026

I focused on learning and practicing Docker concepts. I explored various images available on Docker Hub to understand how different applications are packaged and deployed using containers. By browsing through multiple repositories, I gained insights into how images are structured, their use cases, and how they can be pulled and run locally. I also experimented with running at least one image, which helped me better understand container behavior, configuration, and execution in a real environment. This hands-on exploration improved my understanding of Docker workflows and strengthened my practical skills in containerization.

The AI Compliment Mirror

I successfully built an automated "AI Compliment Mirror" agent using Docker Compose to manage a multi-service architecture. The project’s goal was to create a private, locally-hosted AI that acts as a "hype man," transforming mundane daily tasks into celebrated achievements through both text and audio. By orchestrating three separate digital components—a text-processing "Brain," a visual "Interface," and a "Voice Engine"—I created a system where all parts communicate instantly without needing an internet connection.
The implementation involved configuring the AI with a specific "funny" persona that uses Prompt Engineering to deliver over-the-top praise and virtual awards. To enhance the experience, I integrated a Text-to-Speech (TTS) feature, which I nicknamed the "Voice of God." This allows the agent to immediately speak its compliments out loud, providing an immersive and hands-free interaction.

To ensure the project is sustainable, I used Docker Volumes to save the AI’s memory and settings directly on my computer. This ensures that the agent retains its personality and the downloaded AI models even after the system is turned off. This project demonstrates a practical application of AI orchestration, showing how complex technology can be simplified into a fun, interactive, and private personal assistant.

Date 04-5-2026
Today I explored the basics of REST architecture by building a simple movie recommendation example. I understood how APIs use HTTP methods like GET to fetch movie data, POST to add new movies, PUT to update existing movie details, and DELETE to remove movies. This helped me understand how client and server communicate in a structured and simple way.

I also worked with FastAPI to implement these endpoints quickly. I learned how to define routes, handle requests, and validate data using schemas. The automatic /docs interface helped me test all the API endpoints easily and see real-time responses, which made learning more practical and clear.

In addition, I explored Docker and understood how to containerize the FastAPI application. I created a Dockerfile, built an image, and ran the application inside a container. This helped me understand how Docker ensures the application runs consistently across different environments without dependency issues.