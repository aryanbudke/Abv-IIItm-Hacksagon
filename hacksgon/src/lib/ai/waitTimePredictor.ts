import * as tf from '@tensorflow/tfjs';

export class WaitTimePredictor {
  private model: tf.LayersModel | null = null;

  async initialize() {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [5], units: 16, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 8, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'linear' })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae']
    });
  }

  async train(historicalData: {
    patientsWaiting: number[];
    emergencyCount: number[];
    doctorAvailability: number[];
    averageTreatmentTime: number[];
    hourOfDay: number[];
    actualWaitTime: number[];
  }) {
    if (!this.model) await this.initialize();

    const xs = tf.tensor2d(
      historicalData.patientsWaiting.map((_, i) => [
        historicalData.patientsWaiting[i],
        historicalData.emergencyCount[i],
        historicalData.doctorAvailability[i],
        historicalData.averageTreatmentTime[i],
        historicalData.hourOfDay[i]
      ])
    );

    const ys = tf.tensor2d(
      historicalData.actualWaitTime.map(time => [time])
    );

    await this.model!.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0
    });

    xs.dispose();
    ys.dispose();
  }

  async predict(
    patientsWaiting: number,
    emergencyCount: number,
    doctorAvailability: number,
    averageTreatmentTime: number,
    hourOfDay: number
  ): Promise<number> {
    if (!this.model) {
      return this.fallbackPrediction(patientsWaiting, averageTreatmentTime, emergencyCount);
    }

    const input = tf.tensor2d([[
      patientsWaiting,
      emergencyCount,
      doctorAvailability,
      averageTreatmentTime,
      hourOfDay
    ]]);

    const prediction = this.model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();

    return Math.max(0, Math.round(result[0]));
  }

  private fallbackPrediction(
    patientsWaiting: number,
    averageTreatmentTime: number,
    emergencyCount: number
  ): number {
    const baseTime = patientsWaiting * averageTreatmentTime;
    const emergencyDelay = emergencyCount * 15;
    return Math.round(baseTime + emergencyDelay);
  }

  async save(path: string) {
    if (this.model) {
      await this.model.save(path);
    }
  }

  async load(path: string) {
    this.model = await tf.loadLayersModel(path);
  }
}

export const waitTimePredictor = new WaitTimePredictor();
