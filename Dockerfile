# Use the official Node.js image as base
FROM node:21.2.0

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Rebuild bcrypt
RUN npm rebuild bcrypt --build-from-source

# Copy the rest of the application code to the working directory
COPY . .

# Expose port 3000 (or the port your Node.js app listens on)
EXPOSE 3000

# Command to run the Node.js application
CMD ["node", "app.js"]
