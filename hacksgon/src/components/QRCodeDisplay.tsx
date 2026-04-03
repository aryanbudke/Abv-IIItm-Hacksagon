"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  qrData: string;
  onComplete: () => void;
}

export function QRCodeDisplay({ qrData, onComplete }: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        setQrCodeUrl(url);
      } catch (err) {
        console.error("Error generating QR code:", err);
      }
    };

    generateQR();
  }, [qrData]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Your QR Code</h2>
        <p className="text-gray-600 mb-6">
          Show this QR code at the counter for check-in
        </p>
        
        {qrCodeUrl ? (
          <div className="mb-6">
            <img
              src={qrCodeUrl}
              alt="Queue QR Code"
              className="w-64 h-64 mx-auto border-2 border-gray-300 rounded-lg"
            />
          </div>
        ) : (
          <div className="w-64 h-64 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-6">
            <div className="text-gray-400">Generating QR Code...</div>
          </div>
        )}

        <div className="mb-4">
          <div className="text-sm text-gray-500 mb-2">Automatically continuing in...</div>
          <div className="flex justify-center space-x-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i < countdown ? "bg-blue-600" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Continue to Token
        </button>
      </div>
    </div>
  );
}
