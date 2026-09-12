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

# Remove the repository-only prepare script, then install from a tarball so npm does
# not create a global symlink whose dependencies cannot be resolved from /app.
RUN npm pkg delete scripts.prepare \
	&& npm pack \
	&& npm install -g ./critical-*.tgz playwright@${PLAYWRIGHT_VERSION}

WORKDIR /site

CMD ["critical", "--help"]
