##########################################################
## These first commands are all run under the `root` user
##########################################################
## specify the node base image with your desired version node:<version>
FROM ubuntu:16.04

## Install latest chrome dev package.
## Note: this installs the necessary libs to make the bundled version of Chromium that Puppeteer installs, work. Also works for Chromeless, and Chrome in -headless mode.

RUN apt-get update && apt-get clean && apt-get install -y \
    x11vnc \
    xvfb \
    fluxbox \
    wmctrl \
    wget \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update && apt-get -y install google-chrome-stable \
    && apt-get -y autoclean

# Add additional dependencies here, to not invalidate the primary cache
RUN apt-get install -y nano \
                       curl

# Tini the "zombie reaper" is now available at /sbin/tini
# Whatever you put in the CMD [] section is what Tini will run as its default args
# Add Tini
ENV TINI_VERSION v0.16.1
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]


# Adds a user to the OS
RUN useradd node

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# NVM environment variables
ENV HOME=/home/node
ENV NVM_DIR=$HOME/.nvm
ENV NODE_VERSION 10.1.0

# Creates the dir including its "parents" -with p
RUN mkdir -p $HOME/.nvm

# Install nvm
# Install node and npm
# https://github.com/creationix/nvm#install-script
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# Add node and npm to path so the commands are available
ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH


# Confirm installation
RUN node -v
RUN npm -v

# Install app dependencies
COPY . /home/node/app/

# Set NPM global install path into home directory so permissions are correct
RUN mkdir /home/node/.npm-global
RUN npm config set prefix "/home/node/.npm-global"
ENV PATH="/home/node/.npm-global/bin:${PATH}"

# Fix permissions so user Node can work with files
RUN chown -v -R node:node /home/node

#########################################################
# NOW, the following commands are run under the `node` user
#########################################################
# USER node MUST BE FIRST HERE!
USER node

# Install global packages, then local packages on frontend, then local packages on backend-nodejs, then build frontend, then build backend.
WORKDIR /home/node/app

RUN npm install

# Run your program under Tini
# Starts the primary app - Virtual Display Manager
CMD './launch-virtual-display.sh
