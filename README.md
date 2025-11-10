
# MediPredict AI - Local Setup Guide

This guide provides step-by-step instructions to set up and run the MediPredict AI application on your local machine using Node.js and Vite.

## Prerequisites

Before you begin, ensure you have the following installed on your system:
- **Node.js**: Version 18.x or later. You can download it from [nodejs.org](https://nodejs.org/).
- **npm**: A package manager for Node.js, which is included in your Node.js installation.

## Step 1: Set Up Project Files

1.  Create a new folder for your project on your computer. For example: `medipredict-ai`.
2.  Inside this new folder, place the following files from the application:
    - `index.html`
    - `index.tsx`
    - `metadata.json` (optional, not required for local execution)

## Step 2: Initialize the Project

1.  Open your terminal or command prompt.
2.  Navigate into the project folder you just created:
    ```bash
    cd medipredict-ai
    ```
3.  Initialize a new Node.js project. This will create a `package.json` file to manage your project's dependencies.
    ```bash
    npm init -y
    ```

## Step 3: Install Dependencies

Install the required libraries (React, Google GenAI, etc.) and development tools (Vite, TypeScript).

Run the following command in your terminal:

```bash
npm install react react-dom @google/genai jspdf
npm install --save-dev typescript @types/react @types/react-dom vite @vitejs/plugin-react
```

## Step 4: Configure the Development Environment

You need to create a few configuration files for Vite and TypeScript to work correctly.

1.  **Create a Vite config file.** In your project's root directory, create a new file named `vite.config.ts` and add the following content:

    ```typescript
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'

    // https://vitejs.dev/config/
    export default defineConfig({
      plugins: [react()],
      server: {
        port: 3000 // You can change the port if needed
      }
    })
    ```

2.  **Create a TypeScript config file.** In the root directory, create a file named `tsconfig.json` with the following content. This tells the TypeScript compiler how to handle your `.tsx` file.

    ```json
    {
      "compilerOptions": {
        "target": "ESNext",
        "useDefineForClassFields": true,
        "lib": ["DOM", "DOM.Iterable", "ESNext"],
        "allowJs": false,
        "skipLibCheck": true,
        "esModuleInterop": false,
        "allowSyntheticDefaultImports": true,
        "strict": true,
        "forceConsistentCasingInFileNames": true,
        "module": "ESNext",
        "moduleResolution": "Node",
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx"
      },
      "include": ["index.tsx"],
      "references": [{ "path": "./tsconfig.node.json" }]
    }
    ```

3.  **Create a tsconfig.node.json file.** This is referenced by the main tsconfig file. Create `tsconfig.node.json` with this content:
    ```json
    {
        "compilerOptions": {
            "composite": true,
            "skipLibCheck": true,
            "module": "ESNext",
            "moduleResolution": "bundler",
            "allowSyntheticDefaultImports": true
        },
        "include": ["vite.config.ts"]
    }
    ```

## Step 5: Set Up Your API Key

Your API key must be kept secret and should not be written directly in the code.

1.  In your project's root directory, create a new file named `.env`.
2.  Inside the `.env` file, add your Gemini API key like this (replace `YOUR_API_KEY_HERE` with your actual key):

    ```
    VITE_API_KEY=YOUR_API_KEY_HERE
    ```

    **Note:** Vite requires environment variables exposed to the browser to be prefixed with `VITE_`.

## Step 6: Add Run Scripts to `package.json`

Open your `package.json` file and add the `scripts` section as shown below. This will give you convenient commands to start and build your application.

```json
{
  "name": "medipredict-ai",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^1.27.0",
    "jspdf": "^2.5.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
```
*(Note: Your dependency versions may vary slightly, which is perfectly fine).*


## Step 7: Run the Application!

You are all set! To start the local development server, run the following command in your terminal:

```bash
npm run dev
```

Your terminal will display a local address, usually `http://localhost:3000`. Open this URL in your web browser to see your application running.
