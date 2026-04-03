import { supabase } from '@/lib/supabase/client';

interface CounterLoad {
  counterId: string;
  counterNumber: number;
  hospitalId: string;
  departmentId: string;
  waitingCount: number;
  doctorId: string;
}

class CounterOptimizationService {
  /**
   * Optimizes patient distribution across counters in a department
   * Redistributes patients to balance the load evenly
   */
  async optimizeCounterLoad(hospitalId: string, departmentId: string): Promise<boolean> {
    try {
      console.log(`🔄 Starting counter optimization for hospital ${hospitalId}, department ${departmentId}`);

      // Get all counters for this department
      const { data: counters, error: countersError } = await supabase
        .from('counters')
        .select('*')
        .eq('hospital_id', hospitalId)
        .eq('department_id', departmentId);

      if (countersError) throw countersError;
      if (!counters || counters.length === 0) {
        console.log('No counters found for optimization');
        return false;
      }

      // Get all waiting patients for this department
      const { data: waitingPatients, error: patientsError } = await supabase
        .from('queue')
        .select('*')
        .eq('hospital_id', hospitalId)
        .eq('department_id', departmentId)
        .eq('status', 'waiting')
        .order('created_at', { ascending: true });

      if (patientsError) throw patientsError;
      if (!waitingPatients || waitingPatients.length === 0) {
        console.log('No waiting patients to optimize');
        return true;
      }

      const totalPatients = waitingPatients.length;
      const totalCounters = counters.length;
      const patientsPerCounter = Math.floor(totalPatients / totalCounters);
      const remainder = totalPatients % totalCounters;

      console.log(`📊 Optimization stats:`, {
        totalPatients,
        totalCounters,
        patientsPerCounter,
        remainder
      });

      // Redistribute patients evenly across counters
      let patientIndex = 0;
      for (let i = 0; i < counters.length; i++) {
        const counter = counters[i];
        const patientsForThisCounter = patientsPerCounter + (i < remainder ? 1 : 0);

        for (let j = 0; j < patientsForThisCounter && patientIndex < totalPatients; j++) {
          const patient = waitingPatients[patientIndex];
          
          // Update patient's counter assignment
          await supabase
            .from('queue')
            .update({
              counter_id: counter.id,
              counter_number: counter.counter_number,
              doctor_id: counter.doctor_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', patient.id);

          patientIndex++;
        }
      }

      console.log(`✅ Counter optimization completed. ${totalPatients} patients redistributed across ${totalCounters} counters`);
      return true;

    } catch (error) {
      console.error('❌ Error optimizing counter load:', error);
      return false;
    }
  }

  /**
   * Gets current load distribution across all counters in a department
   */
  async getCounterLoadDistribution(hospitalId: string, departmentId: string): Promise<CounterLoad[]> {
    try {
      const { data: counters, error: countersError } = await supabase
        .from('counters')
        .select('*')
        .eq('hospital_id', hospitalId)
        .eq('department_id', departmentId);

      if (countersError) throw countersError;
      if (!counters) return [];

      const counterLoads: CounterLoad[] = [];

      for (const counter of counters) {
        const { count } = await supabase
          .from('queue')
          .select('*', { count: 'exact', head: true })
          .eq('counter_id', counter.id)
          .eq('status', 'waiting');

        counterLoads.push({
          counterId: counter.id,
          counterNumber: counter.counter_number,
          hospitalId: counter.hospital_id,
          departmentId: counter.department_id,
          waitingCount: count || 0,
          doctorId: counter.doctor_id
        });
      }

      return counterLoads;
    } catch (error) {
      console.error('Error getting counter load distribution:', error);
      return [];
    }
  }

  /**
   * Automatically triggers optimization if load imbalance is detected
   */
  async autoOptimizeIfNeeded(hospitalId: string, departmentId: string): Promise<boolean> {
    try {
      const loads = await this.getCounterLoadDistribution(hospitalId, departmentId);
      
      if (loads.length === 0) return false;

      const waitingCounts = loads.map(l => l.waitingCount);
      const maxLoad = Math.max(...waitingCounts);
      const minLoad = Math.min(...waitingCounts);
      const loadDifference = maxLoad - minLoad;

      // If difference is more than 3 patients, optimize
      if (loadDifference > 3) {
        console.log(`⚠️ Load imbalance detected: max=${maxLoad}, min=${minLoad}, diff=${loadDifference}`);
        return await this.optimizeCounterLoad(hospitalId, departmentId);
      }

      return false;
    } catch (error) {
      console.error('Error in auto-optimization:', error);
      return false;
    }
  }
}

export const counterOptimizationService = new CounterOptimizationService();
