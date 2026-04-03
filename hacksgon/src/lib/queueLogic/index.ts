export interface QueueConfig {
  priorityWeights: {
    emergency: number;
    vip: number;
    elderly: number;
    regular: number;
  };
  averageServiceTime: number; // in minutes
  maxQueueLength: number;
  overflowThreshold: number;
}

export interface QueueCustomer {
  id: string;
  name: string;
  priority: 'emergency' | 'vip' | 'elderly' | 'regular';
  arrivalTime: Date;
  estimatedWaitTime: number;
  serviceType: string;
  counterId?: string;
  locationId?: string;
  isRemote?: boolean;
}

export interface Counter {
  id: string;
  name: string;
  status: 'open' | 'closed' | 'busy';
  currentCustomerId?: string;
  queueLength: number;
  averageServiceTime: number;
  locationId: string;
  staffId: string;
}

export interface QueueMetrics {
  totalCustomers: number;
  averageWaitTime: number;
  longestWaitTime: number;
  customersServedPerHour: number;
  queueLength: number;
  serviceRate: number;
}

export class SmartQueueManager {
  private config: QueueConfig;
  private queue: QueueCustomer[] = [];
  private counters: Counter[] = [];
  private metrics: QueueMetrics;

  constructor(config: QueueConfig) {
    this.config = config;
    this.metrics = {
      totalCustomers: 0,
      averageWaitTime: 0,
      longestWaitTime: 0,
      customersServedPerHour: 0,
      queueLength: 0,
      serviceRate: 0
    };
  }

  // Add customer to queue with smart priority calculation
  addCustomer(customer: QueueCustomer): number {
    const position = this.calculatePosition(customer);
    customer.estimatedWaitTime = this.calculateWaitTime(position);
    
    this.queue.splice(position, 0, customer);
    this.updateMetrics();
    
    return position;
  }

  // Calculate position based on priority
  private calculatePosition(newCustomer: QueueCustomer): number {
    let position = 0;
    
    for (const customer of this.queue) {
      const priorityScore = this.getPriorityScore(newCustomer);
      const existingScore = this.getPriorityScore(customer);
      
      if (priorityScore > existingScore) {
        break;
      }
      position++;
    }
    
    return position;
  }

  // Get priority score for customer
  private getPriorityScore(customer: QueueCustomer): number {
    const baseScore = this.config.priorityWeights[customer.priority];
    const waitTimePenalty = Math.max(0, (Date.now() - customer.arrivalTime.getTime()) / (1000 * 60 * 30)); // Penalty for waiting 30+ min
    
    return baseScore - waitTimePenalty;
  }

  // Calculate estimated wait time
  public calculateWaitTime(position: number): number {
    return position * this.config.averageServiceTime;
  }

  // Assign smart counter based on queue load
  assignOptimalCounter(customerId: string): string | null {
    const availableCounters = this.counters.filter(counter => 
      counter.status === 'open' && !counter.currentCustomerId
    );

    if (availableCounters.length === 0) {
      return null;
    }

    // Find counter with shortest queue
    return availableCounters.reduce((shortest, current) => 
      current.queueLength < shortest.queueLength ? current : shortest
    ).id;
  }

  // Predict optimal counter opening
  predictCounterOpening(): boolean {
    const totalQueueLength = this.counters.reduce((sum, counter) => sum + counter.queueLength, 0);
    const averageServiceTime = this.config.averageServiceTime;
    const totalCustomers = this.queue.length;

    // Open new counter if average wait time exceeds threshold
    const averageWaitTime = (totalCustomers * averageServiceTime) / this.counters.length;
    
    return averageWaitTime > this.config.overflowThreshold && 
           totalQueueLength > this.config.maxQueueLength * 0.8;
  }

  // Handle overflow queue
  createOverflowQueue(): QueueCustomer[] {
    const overflowThreshold = this.config.maxQueueLength;
    return this.queue.slice(overflowThreshold);
  }

  // Transfer customer between counters
  transferCustomer(customerId: string, fromCounterId: string, toCounterId: string): boolean {
    const fromCounter = this.counters.find(c => c.id === fromCounterId);
    const toCounter = this.counters.find(c => c.id === toCounterId);

    if (!fromCounter || !toCounter || toCounter.status !== 'open') {
      return false;
    }

    // Transfer logic
    fromCounter.currentCustomerId = undefined;
    toCounter.currentCustomerId = customerId;
    
    return true;
  }

  // Update queue metrics
  private updateMetrics(): void {
    const now = Date.now();
    const waitingCustomers = this.queue.filter(c => 
      (now - c.arrivalTime.getTime()) < (1000 * 60 * 60) // Last hour
    );

    this.metrics = {
      totalCustomers: this.queue.length,
      averageWaitTime: this.calculateAverageWaitTime(),
      longestWaitTime: this.calculateLongestWaitTime(),
      customersServedPerHour: waitingCustomers.length,
      queueLength: this.queue.length,
      serviceRate: this.calculateServiceRate()
    };
  }

  private calculateAverageWaitTime(): number {
    if (this.queue.length === 0) return 0;
    
    const totalWaitTime = this.queue.reduce((sum, customer) => 
      sum + customer.estimatedWaitTime, 0
    );
    
    return totalWaitTime / this.queue.length;
  }

  private calculateLongestWaitTime(): number {
    if (this.queue.length === 0) return 0;
    
    return Math.max(...this.queue.map(customer => customer.estimatedWaitTime));
  }

  private calculateServiceRate(): number {
    const servedCustomers = this.metrics.customersServedPerHour;
    const timeWindow = 60; // minutes
    
    return servedCustomers / timeWindow;
  }

  // Get current queue state
  getQueueState(): {
    queue: QueueCustomer[];
    metrics: QueueMetrics;
    counters: Counter[];
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    if (this.predictCounterOpening()) {
      recommendations.push('Consider opening additional counters to reduce wait time');
    }
    
    if (this.metrics.averageWaitTime > this.config.overflowThreshold) {
      recommendations.push('Queue length is high - consider overflow management');
    }

    return {
      queue: [...this.queue],
      metrics: this.metrics,
      counters: [...this.counters],
      recommendations
    };
  }

  // Update counters
  updateCounters(counters: Counter[]): void {
    this.counters = counters;
    this.updateMetrics();
  }

  // Remove customer from queue
  removeCustomer(customerId: string): QueueCustomer | null {
    const index = this.queue.findIndex(c => c.id === customerId);
    if (index !== -1) {
      const customer = this.queue.splice(index, 1)[0];
      this.updateMetrics();
      return customer;
    }
    return null;
  }

  // Update customer position
  updateCustomerPositions(): void {
    this.queue.forEach((customer, index) => {
      customer.estimatedWaitTime = this.calculateWaitTime(index);
    });
  }
}
