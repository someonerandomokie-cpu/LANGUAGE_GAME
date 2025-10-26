### Step 1: Set Up the Project Structure

1. **Create a new directory for your project**:
   ```bash
   mkdir my-app
   cd my-app
   ```

2. **Initialize a new React application**:
   ```bash
   npx create-react-app frontend
   ```

3. **Create a backend directory**:
   ```bash
   mkdir backend
   cd backend
   ```

4. **Initialize a new Node.js application**:
   ```bash
   npm init -y
   ```

5. **Install Express**:
   ```bash
   npm install express cors body-parser
   ```

### Step 2: Create the Backend

1. **Create a file named `server.js` in the `backend` directory**:
   ```javascript
   // backend/server.js
   const express = require('express');
   const cors = require('cors');
   const bodyParser = require('body-parser');

   const app = express();
   const PORT = process.env.PORT || 5000;

   app.use(cors());
   app.use(bodyParser.json());

   // Sample endpoint
   app.get('/api/data', (req, res) => {
       res.json({ message: 'Hello from the backend!' });
   });

   app.listen(PORT, () => {
       console.log(`Server is running on http://localhost:${PORT}`);
   });
   ```

2. **Run the backend server**:
   ```bash
   node server.js
   ```

### Step 3: Integrate the Backend with the Frontend

1. **Navigate to the `frontend` directory**:
   ```bash
   cd ../frontend
   ```

2. **Install Axios for making HTTP requests**:
   ```bash
   npm install axios
   ```

3. **Modify `App.jsx` to fetch data from the backend**:
   ```javascript
   // frontend/src/App.jsx
   import React, { useEffect, useState } from 'react';
   import axios from 'axios';

   function App() {
       const [data, setData] = useState(null);

       useEffect(() => {
           const fetchData = async () => {
               try {
                   const response = await axios.get('http://localhost:5000/api/data');
                   setData(response.data.message);
               } catch (error) {
                   console.error('Error fetching data:', error);
               }
           };

           fetchData();
       }, []);

       return (
           <div>
               <h1>Backend Integration Example</h1>
               {data ? <p>{data}</p> : <p>Loading...</p>}
           </div>
       );
   }

   export default App;
   ```

### Step 4: Run the Frontend

1. **Start the React application**:
   ```bash
   npm start
   ```

### Step 5: Test the Application

1. Open your browser and navigate to `http://localhost:3000`.
2. You should see "Backend Integration Example" and the message fetched from the backend.

### Summary

You now have a simple React application that integrates with a Node.js backend. The frontend fetches data from the backend using Axios and displays it. You can expand this project by adding more endpoints, handling different HTTP methods, and implementing more complex state management as needed.