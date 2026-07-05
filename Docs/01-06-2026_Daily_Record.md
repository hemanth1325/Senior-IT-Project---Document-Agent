# VPS Setup, Docker Installation, and Caddy Reverse Proxy Configuration

## Project Overview

This document describes the complete setup process for a Contabo VPS running Ubuntu 26.04 LTS, including:

 VPS access via SSH
 User creation and security setup
 Docker installation
 Firewall configuration
 Caddy Docker Proxy setup
 Test container deployment
 Docker permission troubleshooting.



# Server Information

| Item               | Value              |
|  |  |
| Provider           | Contabo            |
| Operating System   | Ubuntu 26.04 LTS   |
| Hostname           | vmd198586          |
| Public IP          | 80.241.209.18      |
| Main User          | user_1             |
| Container Platform | Docker             |
| Reverse Proxy      | Caddy Docker Proxy |

# Phase 1: VPS Access
## Connect to VPS

```bash
ssh root@80.241.209.18
```

Purpose:

 Connect to the VPS using the root account.



## Check System Resources

```bash
htop
```

Purpose:

 Monitor CPU, memory, and running processes.



# Phase 2: Create a Secure User

## Create New User

```bash
adduser user_1
```

Purpose:

 Create a nonroot user for daily administration.



## Grant Sudo Access

```bash
usermod aG sudo user_1
```

Purpose:

 Allow administrative commands using sudo.



## Create SSH Directory

```bash
mkdir /home/user_1/.ssh
```

Purpose:

 Store SSH authentication keys.



## Secure SSH Directory

```bash
chmod 700 /home/user_1/.ssh
chmod 600 /home/user_1/.ssh/authorized_keys
```

Purpose:

 Restrict access to SSH configuration files.



## Reload SSH

```bash
systemctl reload ssh
```

Purpose:

 Apply SSH configuration changes.



## Login with New User

```bash
ssh user_1@80.241.209.18
```

Purpose:

 Verify user login works correctly.



# Phase 3: Install Docker

## Update Package Lists

```bash
sudo apt update
```

Purpose:

 Refresh Ubuntu package repositories.



## Install Required Packages

```bash
sudo apt install cacertificates curl gnupg
```

Purpose:

 Install dependencies required for Docker installation.



## Create Docker Key Directory

```bash
sudo install m 0755 d /etc/apt/keyrings
```

Purpose:

 Store Docker GPG keys securely.



## Add Docker GPG Key

```bash
curl fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg dearmor o /etc/apt/keyrings/docker.gpg
```

Purpose:

 Add Docker's official package signing key.



## Set Key Permissions

```bash
sudo chmod a+r /etc/apt/keyrings/docker.gpg
```

Purpose:

 Allow package manager access to the key.



## Add Docker Repository

```bash
echo \
"deb [arch=$(dpkg printarchitecture) signedby=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(. /etc/osrelease && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Purpose:

 Add Docker's official repository.



## Update Repositories

```bash
sudo apt update
```

Purpose:

 Load packages from Docker repository.



## Install Docker

```bash
sudo apt install dockerce dockercecli containerd.io dockerbuildxplugin dockercomposeplugin
```

Installed Components:

 Docker Engine
 Docker CLI
 Containerd
 Docker Buildx
 Docker Compose Plugin



## Verify Docker Service

```bash
sudo systemctl status docker
```

Expected Result:

```text
Active: active (running)
```

Purpose:

 Confirm Docker is running.



# Phase 4: Configure Firewall

## Allow SSH

```bash
sudo ufw allow ssh
```

Purpose:

 Allow remote SSH access.



## Allow HTTP

```bash
sudo ufw allow http
```

Purpose:

 Open port 80.



## Allow HTTPS

```bash
sudo ufw allow https
```

Purpose:

 Open port 443.



## Check Firewall Status

```bash
sudo ufw status verbose
```

Purpose:

 Verify firewall rules.



## Enable Firewall

```bash
sudo ufw enable
```

Purpose:

 Activate firewall protection.



## Verify Rules

```bash
sudo ufw status verbose
```

Expected Open Ports:

| Port | Service |
|  |  |
| 22   | SSH     |
| 80   | HTTP    |
| 443  | HTTPS   |



# Phase 5: Create Docker Network for Caddy

## Create Shared Network

```bash
sudo docker network create caddy
```

Purpose:

 Create a shared Docker network for applications behind Caddy.



## Verify Network

```bash
sudo docker network ls
```

Purpose:

 Confirm network creation.



# Phase 6: Deploy Caddy Docker Proxy

## Navigate to Docker Directory

```bash
cd /opt/docker
```



## Check Files

```bash
ls
```

Expected:

```text
dockercompose.yml
```



## Start Caddy

```bash
sudo docker compose up d
```

Purpose:

 Deploy Caddy Docker Proxy.



## Verify Running Containers

```bash
sudo docker ps
```

Expected Container:

```text
lucaslorentz/caddydockerproxy
```

Purpose:

 Confirm Caddy is running.



# Phase 7: Create Test Application

## Create Compose File

```yaml
services:
  whoami:
    image: traefik/whoami
    networks:
       caddy
    labels:
      caddy: whoami.mdhbookstack.duckdns.org
      caddy.reverse_proxy: "{{upstreams 80}}"

networks:
  caddy:
    external: true
```

Purpose:

 Create a simple container for testing reverse proxy functionality.



## Start Test Container

```bash
sudo docker compose up d
```

Purpose:

 Launch the Whoami test application.



## Verify Containers

```bash
sudo docker ps
```

Expected:

```text
dockercaddy1
user_1whoami1
```

Purpose:

 Confirm both containers are running.



# Phase 8: Fix Docker Permission Issues

## Problem

Running Docker commands without sudo produced:

```text
permission denied while trying to connect to the docker API
```

Reason:

 User was not part of the Docker group.



## Add User to Docker Group

```bash
sudo usermod aG docker user_1
```

Alternative:

```bash
sudo usermod aG docker ${USER}
```

Purpose:

 Allow Docker usage without sudo.



## Reload Group Membership

```bash
su  ${USER}
```

Purpose:

 Refresh user session.



## Verify Membership

```bash
groups
```

Expected:

```text
user_1 sudo users docker
```

Purpose:

 Confirm Docker group membership.



## Test Docker Without Sudo

```bash
docker compose up
```

Purpose:

 Verify Docker can be used without elevated privileges.



# Phase 9: Verify Deployment

## Check Current Directory

```bash
pwd
```

Expected:

```text
/ home / user_1
```



## View Compose File

```bash
cat dockercompose.yml
```

Purpose:

 Verify deployment configuration.



## Test Domain

```bash
ping mdhbookstack.duckdns.org
```

Purpose:

 Verify DNS resolution.



# Final Result

✅ VPS created and secured

✅ Nonroot administration user configured

✅ SSH configured

✅ Docker installed

✅ Docker Compose installed

✅ Firewall enabled

✅ Ports 22, 80, and 443 opened

✅ Caddy reverse proxy deployed

✅ Shared Docker network created

✅ Test container deployed

✅ Docker permissions fixed



