"use client";

import { useState } from "react";

interface TokenDisplayProps {
  tokenNumber: number;
  name: string;
}

export function TokenDisplay({ tokenNumber, name }: TokenDisplayProps) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(`Token: ${tokenNumber}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
        <div className="mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Success!</h2>
          <p className="text-gray-600">You have joined the queue</p>
        </div>

        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 mb-6 text-white">
          <div className="text-sm uppercase tracking-wide mb-2">Your Token Number</div>
          <div className="text-5xl font-bold mb-2">{tokenNumber}</div>
          <div className="text-sm opacity-90">Generated at {formatTime()}</div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-sm text-gray-600 mb-1">Registered to</div>
          <div className="font-semibold text-gray-900">{name}</div>
        </div>

        <div className="space-y-3">
          <button
            onClick={copyToClipboard}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{isCopied ? "Copied!" : "Copy Token Number"}</span>
          </button>
          
          <button
            onClick={() => window.location.reload()}
            className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Join Another Queue
          </button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Please keep this token number safe and show it at the counter when called.
        </div>
      </div>
    </div>
  );
}
