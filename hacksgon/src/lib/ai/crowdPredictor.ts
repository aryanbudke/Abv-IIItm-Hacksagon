import { HistoricalData } from '../types';

export interface CrowdPrediction {
  hour: number;
  predictedCount: number;
  crowdLevel: 'low' | 'medium' | 'high';
}

export class CrowdPredictor {
  predictCrowdByHour(historicalData: HistoricalData[]): CrowdPrediction[] {
    const hourlyData: { [hour: number]: number[] } = {};

    for (let i = 0; i < 24; i++) {
      hourlyData[i] = [];
    }

    historicalData.forEach(data => {
      hourlyData[data.hour].push(data.patientCount);
    });

    const predictions: CrowdPrediction[] = [];

    for (let hour = 0; hour < 24; hour++) {
      const counts = hourlyData[hour];
      const avgCount = counts.length > 0
        ? counts.reduce((a, b) => a + b, 0) / counts.length
        : 0;

      const predictedCount = Math.round(avgCount);
      
      let crowdLevel: 'low' | 'medium' | 'high';
      if (predictedCount < 10) crowdLevel = 'low';
      else if (predictedCount < 25) crowdLevel = 'medium';
      else crowdLevel = 'high';

      predictions.push({
        hour,
        predictedCount,
        crowdLevel
      });
    }

    return predictions;
  }

  getBestTimeSlots(predictions: CrowdPrediction[], count: number = 3): CrowdPrediction[] {
    return predictions
      .filter(p => p.hour >= 8 && p.hour <= 20)
      .sort((a, b) => a.predictedCount - b.predictedCount)
      .slice(0, count);
  }

  getPeakHours(predictions: CrowdPrediction[], count: number = 3): CrowdPrediction[] {
    return predictions
      .sort((a, b) => b.predictedCount - a.predictedCount)
      .slice(0, count);
  }
}

export const crowdPredictor = new CrowdPredictor();
