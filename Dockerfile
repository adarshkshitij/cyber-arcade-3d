# Production static file server for 3D Neon Snake
FROM nginx:alpine

# Copy static game assets
COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY engine.js /usr/share/nginx/html/engine.js
COPY game.js /usr/share/nginx/html/game.js

# Custom lightweight nginx configuration for caching and gzip
RUN printf 'server {\n\
    listen 80;\n\
    server_name localhost;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    gzip on;\n\
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;\n\
    gzip_min_length 256;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
        add_header Cache-Control "no-cache";\n\
    }\n\
\n\
    location ~* \\.(css|js)$ {\n\
        expires 1d;\n\
        add_header Cache-Control "public, no-transform";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
