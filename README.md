# 24/7 Crypto Trading Bot: TradingView.com Charts plus Autoview = ♥

TradingView.com provides powerful charting and indicator tools to create robust trading strategies. However, it does not allow automated trading.

Autoview is a chrome extension that bridges the gap between TradingView.com Charts and your exchange and executes trades automatically based on Alerts you program in TradingView.com Charts.

This project aimed at solving the problem of running a bot locally which does not work when the computer is off. A server was needed, and so I created this Docker image to enable myself and anyone to easily fire up a new container that runs Autoview as a service.

While I could have used a Windows VPS and set it up easily through remote desktop, I did not think of it before creating this, and so I created an Ubuntu 16.04 Docker image with an X-server installed and a VNC server to enable VNC connections (remote desktop). It works perfectly at running Autoview as a service and is easy to setup, only a couple simple steps.

# Steps to get up and running:
 
1) Create an Unbuntu 17.10 server with at least 2GB RAM
2) Run `sudo apt update && sudo apt upgrade` to update all dependencies
3) Install [Docker](https://docs.docker.com/install/linux/docker-ce/ubuntu/#install-docker-ce) and [Docker-compose](https://docs.docker.com/compose/install/).

**To use the pre-compiled Docker Image:**
1) Login via SSH to your server
2) Run `docker pull iamtheiam/autoview-bot`. This will pull the image from the public docker repository I created
3) Follow the steps in Deployment and Startup.

**To build the image from source:**
1) Run `git clone https://github.com/IAMtheIAM/autoview-tradingview-chrome-docker-bot.git`  :
2) Run `npm install`
3) Run `npm run build:docker`
4) Upload the docker image to your server either via Dockerhub or [SSH, see instructions](https://stackoverflow.com/questions/23935141/how-to-copy-docker-images-from-one-host-to-another-without-via-repository):
    1) (From your local machine) `docker save autoview-bot:latest | bzip2 | pv | \
    ssh user@host 'bunzip2 | docker load'`
5) Follow the steps in Deployment and Startup.

## Deployment and Startup

1) Upload `docker-compose.yml` and `launch-virtual-display.sh` to your server.

2) From that same directory, run `sudo docker-compose up`

3) Connect to your Docker container through VNC Viewer. By default it runs on `port 3903` for security. You can change this to any port you want inside the `./launch-virtual-server.sh` script.

4) Right click on the Desktop > Applications > Shell > Bash

5) **OPTIONAL**: To automate logging in to TradingView.com, `nano bot.ts` and enter your username and password on lines 3 and 4. 

6) Manually setup your Autoview credentials like normal in the extension options (click the Autoview extension icon and go to Settings). **OPTIONAL**: To automate adding API credentials into Autoview, `nano bot-setup.ts` and customize the script for the exchanges you will use and your API keys. Then run `npm run setup` to run the Autoview setup script (and load the Autoview extension automatically). Delete the `bot-setup.ts` script when you are done with `rm bot-setup.ts`

7) Run `npm run start` to run load Chrome with the Autoview extension automatically installed. If you did not enter your username and password into `bot.ts`, you will need to manually enter it when the login screen automatically appears after a few seconds (the bot will click login for you).

8) Open up a new tab `localhost:9222` and click Autoview. Now you can see the debugging output for autoview to see if its working.

9) Setup your TradingView.com alerts and watch them get triggered automatically 24/7!

10) OPTIONAL, but strongly recommended: Install a strong firewall with bruteforce detection

`apt install apf-firewall`

 To install BFD, see: [http://www.webhostgear.com/60.html](http://www.webhostgear.com/60.html)

 Configure your ports as desired. It is strongly suggested to run your VNC on a non-standard port for security purposes


If you have any tips or suggestions for improvement, or constructive critisism, open an issue ticket here on GitHub and I will respond to you soon.
