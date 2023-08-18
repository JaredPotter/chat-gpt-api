SERVER

Run on Mac

Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

Set environment variables in `server/.env`

To setup Server to always be running and automatically restart on fail -

yarn add global pm2
From inside the server directory run
yarn forever_start
yarn forever_end

Linux Setup

Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

Set environment variables in `server/.env`

- Ensure the following are installed

  - node
  - yarn
  - xvfb

- Setup xvfb to start up on boot

```
sudo nano /etc/systemd/system/xvfb.service

[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
User=<your-user>
ExecStart=/usr/bin/Xvfb :99

[Install]
WantedBy=multi-user.target

sudo systemctl daemon-reload
sudo systemctl enable xvfb
sudo systemctl start xvfb


```

Setup pm2

```
yarn add global pm2
// From inside the server directory run
yarn forever_start
yarn forever_end
```
