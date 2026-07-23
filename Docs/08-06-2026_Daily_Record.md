
### Hemanth

 Learned how to automatically update the production server whenever new code is pushed to the production Git repository.
 Understood how this automation reduces manual deployment work and keeps the production server up to date.
 Learned how **webhooks** detect Git push events and notify the production server.
 Understood how a **secret token** is used to verify that the webhook request is secure and comes from the Git repository.
 Learned how the server automatically pulls the latest code and updates the application after a successful webhook trigger.
 Explored the complete workflow from **Git push → Webhook → Server update → Production deployment.
 
### Vaman

Today, we learned the concept of automatically updating the production server when changes are pushed to the production Git repository. This process helps reduce manual work because the server can directly receive the latest code updates after a developer pushes changes to the repo.

We also learned how webhooks are used in this process. A webhook listens for Git push events, verifies the request using a secret token, and then triggers the server-side update process so the production application can stay updated with the latest code.
