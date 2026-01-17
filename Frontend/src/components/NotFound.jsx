import { useNavigate } from 'react-router-dom'; 
import { useState,useEffect } from "react";

const NotFound = () => {
  // Define the number of seconds to wait before redirection
  const [seconds, setSeconds] = useState(3); 
  // Get the navigation function from useNavigate hook
  const navigate = useNavigate(); 

  useEffect(() => {
    // redirect to login if timeout reached 0
    if (seconds === 0) {
        navigate('/login');
        return;
    }

    const countdown = setInterval(() => {
        setSeconds(prev => prev - 1);
    }, 1000);

    return () => clearInterval(countdown);
  // dependent on seconds and navigate
  }, [seconds, navigate]);


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-lg">
            <h1 className="text-5xl font-extrabold text-gray-900 mb-4">404</h1>

            <p className="text-lg font-medium text-gray-700 mb-2">Page Not Found</p>

            <p className="text-sm text-gray-500">
            Redirecting to login in
            <span className="font-semibold text-gray-700"> {seconds} </span>
            seconds…
            </p>
        </div>
    </div>
  );
};

export default NotFound;