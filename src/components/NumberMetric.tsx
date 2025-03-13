import React from 'react';

interface NumberMetricProps {
    value: string;
    caption: string;
  }
  
  const NumberMetric: React.FC<NumberMetricProps> = ({ value, caption }) => {
    return (
        <div className="flex flex-col items-center p-4">
            <div className="text-2xl font-bold text-blue-600">{value}</div>
            <div className="text-sm text-gray-500">{caption}</div>
        </div>
    );
}

export default NumberMetric;