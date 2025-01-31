FROM node:20-slim

ARG CRITICAL_VERSION=5.0.4

ARG PACKAGES="\
  libx11-6\
  libx11-xcb1\
  libxcomposite1\
  libxcursor1\
  libxdamage1\
  libxext6\
  libxi6\
  libxtst6\
  libglib2.0-0\
  libnss3\
  libcups2\
  libxss1\
  libexpat1\
  libxrandr2\
  libasound2\
  libatk1.0-0\
  libatk-bridge2.0-0\
  libpangocairo-1.0-0\
  libgtk-3-0\
  "
RUN rm -f /etc/apt/apt.conf.d/docker-clean; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
# hadolint ignore=DL3008
RUN --mount=type=cache,id=build-apt-cache,sharing=locked,target=/var/cache/apt \
    --mount=type=cache,id=build-apt-lib,sharing=locked,target=/var/lib/apt \
    apt-get update -qq \
    && apt-get install --no-install-recommends -y ${PACKAGES} \
    && rm -rf /var/lib/apt/lists /var/cache/apt/archives

RUN --mount=type=cache,id=build-npm-cache,sharing=locked,target=/root/.npm \
  npm install -g critical@${CRITICAL_VERSION}

WORKDIR /site

CMD ["critical", "--help"]
