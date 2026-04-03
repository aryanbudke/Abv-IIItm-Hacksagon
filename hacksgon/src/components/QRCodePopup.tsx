"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Clock, User, Calendar, Activity } from "lucide-react";

interface QRCodePopupProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string;
  tokenNumber: number;
  patientName: string;
  hospitalName: string;
  departmentName: string;
  doctorName: string;
  estimatedWaitTime: number;
  position: number;
  isEmergency?: boolean;
}

export function QRCodePopup({
  isOpen,
  onClose,
  qrCode,
  tokenNumber,
  patientName,
  hospitalName,
  departmentName,
  doctorName,
  estimatedWaitTime,
  position,
  isEmergency = false
}: QRCodePopupProps) {
  const [showSmallQR, setShowSmallQR] = useState(false);

  if (!isOpen && !showSmallQR) return null;

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <>
      {/* Main QR Code Popup */}
      {isOpen && typeof document !== 'undefined' && createPortal(
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 overflow-y-auto">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-auto my-auto max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEmergency ? 'Emergency Queue' : 'Queue Confirmation'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="w-48 h-48 mx-auto mb-4 bg-white p-4 rounded-lg border-2 border-gray-200">
              <img src={qrCode} alt="QR Code" className="w-full h-full" />
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isEmergency 
                ? 'bg-red-100 text-red-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              Token #{tokenNumber}
            </div>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Patient</span>
              </div>
              <span className="text-sm font-medium">{patientName}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Hospital</span>
              </div>
              <span className="text-sm font-medium">{hospitalName}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Department</span>
              </div>
              <span className="text-sm font-medium">{departmentName}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Doctor</span>
              </div>
              <span className="text-sm font-medium">{doctorName}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Wait Time</span>
              </div>
              <span className="text-sm font-medium text-orange-600">
                {formatWaitTime(estimatedWaitTime)}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600">Position</span>
              </div>
              <span className="text-sm font-medium">#{position} in queue</span>
            </div>
          </div>

          <Button
            onClick={() => {
              setShowSmallQR(true);
              onClose();
            }}
            className="w-full"
            variant={isEmergency ? "destructive" : "default"}
          >
            {isEmergency ? 'Emergency Priority Active' : 'View Live Status'}
          </Button>
        </div>
      </div>,
      document.body
      )}

      {/* Small QR Code Widget */}
      {showSmallQR && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 right-4 bg-white rounded-lg shadow-2xl p-3 z-[150] max-w-xs border border-gray-100">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Live Status</h3>
            <button
              onClick={() => setShowSmallQR(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          <div className="w-24 h-24 mx-auto mb-2">
            <img src={qrCode} alt="QR Code" className="w-full h-full" />
          </div>
          
          <div className="text-center space-y-1">
            <div className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
              isEmergency 
                ? 'bg-red-100 text-red-800' 
                : 'bg-blue-100 text-blue-800'
            }`}>
              #{tokenNumber}
            </div>
            <p className="text-xs text-gray-600">
              {formatWaitTime(estimatedWaitTime)} wait
            </p>
            <p className="text-xs text-gray-500">
              Position: #{position}
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
