import React from 'react';

const TailwindTest: React.FC = () => {
  return (
    <div className="p-4 m-4 bg-blue-500 text-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold">Tailwind CSS Test</h2>
      <p className="mt-2 border-2 border-red-500">If you can see this styled with blue background and white text, Tailwind CSS is working!</p>
    </div>
  );
};

export default TailwindTest; 