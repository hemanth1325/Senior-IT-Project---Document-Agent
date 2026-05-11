# Part 3 - User Stories
 
### What is a User Story?

A user story is a structured, fine-grained statement of something a user needs from the system. Unlike a scenario (which is narrative), a user story uses a standard template that makes it easy to estimate, prioritise and track in a product backlog.
 
**Standard format:**

As a `<role>`, I want/need to `<do something>`
 
**With justification:**

As a `<role>`, I want/need to `<do something>` so that `<reason>`
 
**Example:**

As a teacher, I need to report who is attending a class trip so that the school maintains the required health and safety records.
 
---
 
### Project User Stories
 
#### 🔐 Authentication & Roles

* **As a student**, I want to log into the system so that I can access AI-powered academic answers securely.

* **As a staff member**, I want to log into the system so that I can manage and upload academic content.

* **As an admin**, I want to assign roles to users so that system access is controlled based on responsibilities.
 
#### 📚 Knowledge Management (BookStack)

* **As a staff member**, I want to upload PDF documents so that students can access academic materials through the AI system.

* **As a staff member**, I want to organize documents into datasets so that academic content is structured by subject or course.

* **As a staff member**, I want to edit or delete documents so that outdated or incorrect information is removed from the system.
 
#### 🔄 Data Synchronization

* **As a system**, I want to sync BookStack content with the AI retrieval system so that students always receive updated information.

* **As an admin**, I want to manually trigger synchronization so that I can immediately update the AI knowledge base when required.

* **As a system**, I want to automatically synchronize new or updated documents so that no manual effort is required for updates.
 
#### 🤖 AI Question Answering (RAG System)

* **As a student**, I want to ask questions in natural language so that I can get instant academic answers without searching manually.

* **As a system**, I want to retrieve relevant document sections so that responses are based only on verified academic content.

* **As a system**, I want to generate responses using a local LLM so that the system works without external API costs.

* **As a student**, I want to receive citations with answers so that I can verify the source of information.
 
#### 💬 Chat Interface (Open WebUI)

* **As a student**, I want to interact with the AI through a chat interface so that I can ask questions conversationally.

* **As a student**, I want to select a dataset before asking questions so that responses are relevant to my subject.

* **As a student**, I want to view chat history so that I can revisit previous answers and continue learning.
 
#### 📊 Monitoring & Analytics

* **As an admin**, I want to view system usage analytics so that I can monitor adoption and performance.

* **As an admin**, I want to view system logs so that I can debug errors and track system behavior.
 
#### 🔐 Security & Performance

* **As a system owner**, I want secure authentication so that only authorized users can access the system.

* **As a student**, I want fast AI responses so that I can get real-time answers without delay.

* **As a system**, I want encrypted communication so that sensitive data is protected during transmission.
 
#### 🧠 System Maintenance

* **As an admin**, I want automatic backups so that I can prevent data loss in case of system failure.

* **As an admin**, I want system health monitoring so that I can ensure all services are running properly.

 