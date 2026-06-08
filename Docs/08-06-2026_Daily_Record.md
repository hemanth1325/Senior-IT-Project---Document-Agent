### Vaman
Today, we learned the concept of automatically updating the production server when changes are pushed to the production Git repository. This process helps reduce manual work because the server can directly receive the latest code updates after a developer pushes changes to the repo.

We also learned how webhooks are used in this process. A webhook listens for Git push events, verifies the request using a secret token, and then triggers the server-side update process so the production application can stay updated with the latest code.
