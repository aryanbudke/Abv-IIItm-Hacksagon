"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, User, Activity, X } from "lucide-react";
import { toast } from "sonner";

interface EmergencyButtonProps {
  hospitalId: string;
  departmentId: string;
  onEmergencyCreated?: (data: any) => void;
}

export function EmergencyButton({ hospitalId, departmentId, onEmergencyCreated }: EmergencyButtonProps) {
  const { user } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);


  const handleEmergencyClick = async () => {
    setShowModal(true);
  };

  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!hospitalId) {
        toast.error('Please select hospital first');
        setLoading(false);
        return;
      }

      // Create emergency queue entry via API
      const response = await fetch('/api/emergency-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalId,
          patientName: user?.fullName || 'Emergency Patient',
          userId: user?.id || 'emergency_user',
          userEmail: user?.primaryEmailAddress?.emailAddress || ''
        })
      });

      const emergencyDept = await response.json();

      if (response.ok && emergencyDept) {
        setShowModal(false);
        onEmergencyCreated?.(emergencyDept);
        
        toast.success('Emergency queue created! Patient prioritized for immediate attention.');
      } else {
        throw new Error(emergencyDept.error || 'Failed to create emergency queue');
      }
    } catch (error: any) {
      console.error('Error creating emergency queue:', error);
      toast.error(`Failed to create emergency queue: ${error.message}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Emergency Button */}
      <Button
        onClick={handleEmergencyClick}
        className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transform transition-all hover:scale-105"
      >
        <AlertTriangle className="h-5 w-5 mr-2" />
        EMERGENCY
      </Button>

      {/* Emergency Modal */}
      {showModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-red-600">Emergency Queue</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-900">Emergency Protocol</h3>
                    <p className="text-sm text-red-700 mt-1">
                      This will prioritize the patient for immediate medical attention.
                      The patient will be taken to the operation room for emergency surgery.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleEmergencySubmit} className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Emergency Details</span>
                </div>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Immediate priority in queue</li>
                  <li>• Direct to operation room</li>
                  <li>• Emergency surgery protocol initiated</li>
                  <li>• Zero wait time</li>
                  <li>• Critical care team alerted</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={() => setShowModal(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? 'Processing...' : 'Activate Emergency'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </>
  );
}
