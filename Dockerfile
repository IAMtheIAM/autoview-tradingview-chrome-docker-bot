##########################################################
## These first commands are all run under the `root` user
##########################################################
## specify the node base image with your desired version node:<version>
FROM ubuntu:16.04

# NVM environment variables
# Add node and npm to path so the commands are available
ENV HOME=/home/node NODE_VERSION=10.1.0
ENV TINI_VERSION=v0.16.1 NVM_DIR=$HOME/.nvm NODE_PATH=$NVM_DIR/v$NODE_VERSION/lib/node_modules 
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH 
ENV PATH=$HOME/.npm-global/bin:$PATH

# Tini the "zombie reaper" is now available at /sbin/tini
# Whatever you put in the CMD [] section is what Tini will run as its default args
# Add Tini
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
ENTRYPOINT ["/tini", "--"]

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Copy app dependencies
COPY ./launch-virtual-display.sh \
keep-chrome-alive.sh \
bot.ts bot-setup.ts \
package.json \
package-lock.json \
tsconfig.json \
$HOME/app/

# Directories must be copied like this, since it only takes the directory contents, not the directory itself
COPY extension \
$HOME/app/extension

## Install latest chrome dev package.
## Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer installs, work. Also works for Chromeless, and Chrome in -headless mode.
# Adds a user to the OS
# Creates the dir including its "parents" -with p
# Install nvm
# Install node and npm
# https://github.com/creationix/nvm#install-script
# Confirm installation
# Set NPM global install path into home directory so permissions are correct
# Fix permissions so user Node can work with files

RUN chmod +x /tini \
    && apt-get update && apt-get clean && apt-get install -y \
    x11vnc \
    xvfb \
    fluxbox \
    wmctrl \
    wget \
    nano \
    curl \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update && apt-get -y install google-chrome-stable \
    && apt-get -y autoclean \
    && useradd node \
    && mkdir -p $HOME/.nvm \
    && curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default \
    && node -v \
    && npm -v \
    && mkdir $HOME/.npm-global \
    && npm config set prefix ~/.npm-global \
    && chown -v -R node:node $HOME 

 
#########################################################
# NOW, the following commands are run under the `node` user
#########################################################
# USER node MUST BE FIRST HERE!
USER node

# Install global packages, then local packages on frontend, then local packages on backend-nodejs, then build frontend, then build backend.
WORKDIR $HOME/app/

RUN npm install

# Run your program under Tini
#CMD '/path/to/file.extension'
