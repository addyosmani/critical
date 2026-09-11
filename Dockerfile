# Official Playwright image ships Chromium plus every system dependency it needs,
# versioned and maintained upstream. PLAYWRIGHT_VERSION must match the playwright
# npm version below, because the bundled browsers are tied to a specific release.
ARG PLAYWRIGHT_VERSION=1.50.0
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble

# Re-declare after FROM so the ARG is visible in the build stage.
ARG PLAYWRIGHT_VERSION

WORKDIR /app

# Build critical from the committed source instead of pulling from npm, so the image
# always matches this repo and never depends on a published (or unpublished) version.
COPY package.json ./
COPY cli.js ./
COPY src ./src

# Install critical globally along with playwright, the optional peer dependency the
# render engine needs. The static engine works without it.
RUN npm install -g . playwright@${PLAYWRIGHT_VERSION}

WORKDIR /site

CMD ["critical", "--help"]
