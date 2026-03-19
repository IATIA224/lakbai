describe('itineraryCostEstimation - Comprehensive Unit Tests', () => {
  
  // Helper functions for testing
  const toRad = (deg) => (deg * Math.PI) / 180;
  
  const haversineDistance = (a, b) => {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const aVal = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  };

  const calculateFare = (row, distance, minutes) => {
    const base = parseFloat(row["Base Rate(First 5 or 4 kilometers)"]) || 0;
    const perKm = parseFloat(row["Rate per km (₱)"]) || 0;
    const perMin = parseFloat(row["Per Minute Travel time"]) || 0;
    let baseDistance = 5;
    if (row["Vehicle Type"] === "PUJ") baseDistance = 4;
    const extraDistance = Math.max(0, distance - baseDistance);
    return base + extraDistance * perKm + minutes * perMin;
  };

  const calculateJeepneyFare = (distance) => {
    const PUJ_FARE = { base: 13, perKm: 2.2, baseKm: 4 };
    if (distance <= PUJ_FARE.baseKm) return PUJ_FARE.base;
    return PUJ_FARE.base + (distance - PUJ_FARE.baseKm) * PUJ_FARE.perKm;
  };

  class PriorityQueue {
    constructor() {
      this.elements = [];
    }
    enqueue(element, priority) {
      this.elements.push({ element, priority });
      this.elements.sort((a, b) => a.priority - b.priority);
    }
    dequeue() {
      return this.elements.shift();
    }
    isEmpty() {
      return this.elements.length === 0;
    }
  }

  // Test Suite 1: Haversine Distance Function
  describe('haversineDistance', () => {
    test('returns 0 for identical points', () => {
      const p = { lat: 14.5995, lng: 120.9842 };
      expect(haversineDistance(p, p)).toBeCloseTo(0, 1);
    });

    test('calculates distance between Manila and Cebu correctly', () => {
      const manila = { lat: 14.5995, lng: 120.9842 };
      const cebu = { lat: 10.3157, lng: 123.8854 };
      const distance = haversineDistance(manila, cebu);
      expect(distance).toBeGreaterThan(500000); // ~570km
      expect(distance).toBeLessThan(650000);
    });

    test('is symmetric: dist(A,B) == dist(B,A)', () => {
      const a = { lat: 14.5995, lng: 120.9842 };
      const b = { lat: 10.3157, lng: 123.8854 };
      expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 1);
    });

    test('calculates short distances accurately', () => {
      const a = { lat: 14.5995, lng: 120.9842 };
      const b = { lat: 14.6000, lng: 120.9842 };
      const distance = haversineDistance(a, b);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(100); // ~55 meters
    });

    test('handles negative coordinates', () => {
      const a = { lat: -33.8688, lng: 151.2093 }; // Sydney
      const b = { lat: -37.8136, lng: 144.9631 }; // Melbourne
      const distance = haversineDistance(a, b);
      expect(distance).toBeGreaterThan(0);
    });

    test('handles points on equator', () => {
      const a = { lat: 0, lng: 0 };
      const b = { lat: 0, lng: 1 };
      const distance = haversineDistance(a, b);
      expect(distance).toBeGreaterThan(111000); // ~111km per degree at equator
      expect(distance).toBeLessThan(112000);
    });
  });

  // Test Suite 2: Calculate Fare Function
  describe('calculateFare', () => {
    test('calculates Taxi fare correctly within base distance', () => {
      const taxiRow = {
        "Vehicle Type": "Taxi",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "13.5",
        "Per Minute Travel time": "2"
      };
      const fare = calculateFare(taxiRow, 3, 10);
      expect(fare).toBe(40 + 0 + 20); // base + 0 extra km + 10min*2
    });

    test('calculates Taxi fare correctly beyond base distance', () => {
      const taxiRow = {
        "Vehicle Type": "Taxi",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "13.5",
        "Per Minute Travel time": "2"
      };
      const fare = calculateFare(taxiRow, 10, 20);
      expect(fare).toBe(40 + (5 * 13.5) + 40);
    });

    test('calculates PUJ fare with 4km base distance', () => {
      const pujRow = {
        "Vehicle Type": "PUJ",
        "Base Rate(First 5 or 4 kilometers)": "13",
        "Rate per km (₱)": "2.2",
        "Per Minute Travel time": "0"
      };
      const fare = calculateFare(pujRow, 6, 15);
      expect(fare).toBe(13 + (2 * 2.2) + 0);
    });

    test('handles zero distance', () => {
      const taxiRow = {
        "Vehicle Type": "Taxi",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "13.5",
        "Per Minute Travel time": "2"
      };
      const fare = calculateFare(taxiRow, 0, 5);
      expect(fare).toBe(40 + 10);
    });

    test('handles missing values with defaults', () => {
      const incompleteRow = { "Vehicle Type": "Taxi" };
      const fare = calculateFare(incompleteRow, 10, 10);
      expect(fare).toBe(0);
    });

    test('calculates TNVS fare correctly', () => {
      const tnvsRow = {
        "Vehicle Type": "TNVS",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "15",
        "Per Minute Travel time": "2"
      };
      const fare = calculateFare(tnvsRow, 8, 15);
      expect(fare).toBe(40 + (3 * 15) + 30);
    });
  });

  // Test Suite 3: Calculate Jeepney Fare
  describe('calculateJeepneyFare', () => {
    test('returns base fare for distance within base km', () => {
      expect(calculateJeepneyFare(3)).toBe(13);
      expect(calculateJeepneyFare(4)).toBe(13);
    });

    test('calculates fare for distance beyond base km', () => {
      expect(calculateJeepneyFare(6)).toBe(13 + (2 * 2.2));
    });

    test('calculates fare for 10km distance', () => {
      expect(calculateJeepneyFare(10)).toBe(13 + (6 * 2.2));
    });

    test('handles zero distance', () => {
      expect(calculateJeepneyFare(0)).toBe(13);
    });

    test('handles fractional distances', () => {
      expect(calculateJeepneyFare(5.5)).toBe(13 + (1.5 * 2.2));
    });

    test('handles exactly base distance', () => {
      expect(calculateJeepneyFare(4)).toBe(13);
    });
  });

  // Test Suite 4: PriorityQueue Class
  describe('PriorityQueue', () => {
    test('initializes empty', () => {
      const pq = new PriorityQueue();
      expect(pq.isEmpty()).toBe(true);
    });

    test('enqueues and dequeues single element', () => {
      const pq = new PriorityQueue();
      pq.enqueue('A', 1);
      expect(pq.isEmpty()).toBe(false);
      const item = pq.dequeue();
      expect(item.element).toBe('A');
      expect(item.priority).toBe(1);
      expect(pq.isEmpty()).toBe(true);
    });

    test('maintains priority order', () => {
      const pq = new PriorityQueue();
      pq.enqueue('C', 3);
      pq.enqueue('A', 1);
      pq.enqueue('B', 2);
      expect(pq.dequeue().element).toBe('A');
      expect(pq.dequeue().element).toBe('B');
      expect(pq.dequeue().element).toBe('C');
    });

    test('handles same priority elements', () => {
      const pq = new PriorityQueue();
      pq.enqueue('A', 1);
      pq.enqueue('B', 1);
      pq.dequeue();
      expect(pq.isEmpty()).toBe(false);
      pq.dequeue();
      expect(pq.isEmpty()).toBe(true);
    });

    test('handles negative priorities', () => {
      const pq = new PriorityQueue();
      pq.enqueue('A', 5);
      pq.enqueue('B', -1);
      pq.enqueue('C', 0);
      expect(pq.dequeue().element).toBe('B');
      expect(pq.dequeue().element).toBe('C');
      expect(pq.dequeue().element).toBe('A');
    });

    test('handles large number of elements', () => {
      const pq = new PriorityQueue();
      for (let i = 100; i > 0; i--) {
        pq.enqueue(`Item${i}`, i);
      }
      expect(pq.dequeue().element).toBe('Item1');
      expect(pq.dequeue().element).toBe('Item2');
    });
  });

  // Test Suite 5: Constants and Bounds
  describe('Geographic Constants', () => {
    test('Philippines bounds are valid', () => {
      const PHILIPPINES_BOUNDS = [[4.5, 116.8], [21.3, 126.6]];
      expect(PHILIPPINES_BOUNDS[0][0]).toBeLessThan(PHILIPPINES_BOUNDS[1][0]);
      expect(PHILIPPINES_BOUNDS[0][1]).toBeLessThan(PHILIPPINES_BOUNDS[1][1]);
    });

    test('Metro Manila bounds are within Philippines bounds', () => {
      const PHILIPPINES_BOUNDS = [[4.5, 116.8], [21.3, 126.6]];
      const METRO_MANILA_BOUNDS = [[14.3, 120.8], [14.9, 121.3]];
      expect(METRO_MANILA_BOUNDS[0][0]).toBeGreaterThan(PHILIPPINES_BOUNDS[0][0]);
      expect(METRO_MANILA_BOUNDS[1][0]).toBeLessThan(PHILIPPINES_BOUNDS[1][0]);
    });

    test('Taguig bounds are within Metro Manila bounds', () => {
      const METRO_MANILA_BOUNDS = [[14.3, 120.8], [14.9, 121.3]];
      const TAGUIG_BOUNDS = [[14.52, 121.01], [14.60, 121.09]];
      expect(TAGUIG_BOUNDS[0][0]).toBeGreaterThan(METRO_MANILA_BOUNDS[0][0]);
      expect(TAGUIG_BOUNDS[1][0]).toBeLessThan(METRO_MANILA_BOUNDS[1][0]);
    });
  });

  // Test Suite 6: Vehicle Types
  describe('Vehicle Types Configuration', () => {
    const VEHICLE_TYPES = [
      { value: "Taxi", label: "🚕 Taxi", description: "Metered taxi cabs" },
      { value: "TNVS", label: "🚗 Ride-hailing (TNVS)", description: "Grab, Uber-style services" },
      { value: "UVE", label: "🚙 UV Express", description: "Air-conditioned vans" }
    ];

    test('has correct number of vehicle types', () => {
      expect(VEHICLE_TYPES).toHaveLength(3);
    });

    test('each vehicle type has required properties', () => {
      VEHICLE_TYPES.forEach(vt => {
        expect(vt).toHaveProperty('value');
        expect(vt).toHaveProperty('label');
        expect(vt).toHaveProperty('description');
      });
    });

    test('vehicle type values are unique', () => {
      const values = VEHICLE_TYPES.map(vt => vt.value);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    test('labels contain emojis', () => {
      VEHICLE_TYPES.forEach(vt => {
        expect(vt.label).toMatch(/[🚕🚗🚙]/);
      });
    });
  });

  // Test Suite 7: PUJ Fare Constants
  describe('PUJ Fare Configuration', () => {
    const PUJ_FARE = { base: 13, perKm: 2.2, baseKm: 4 };

    test('has valid base fare', () => {
      expect(PUJ_FARE.base).toBe(13);
      expect(PUJ_FARE.base).toBeGreaterThan(0);
    });

    test('has valid per km rate', () => {
      expect(PUJ_FARE.perKm).toBe(2.2);
      expect(PUJ_FARE.perKm).toBeGreaterThan(0);
    });

    test('has valid base km', () => {
      expect(PUJ_FARE.baseKm).toBe(4);
      expect(PUJ_FARE.baseKm).toBeGreaterThan(0);
    });
  });

  // Test Suite 8: Edge Cases
  describe('Edge Cases', () => {
    test('haversine handles very small differences', () => {
      const a = { lat: 14.5995, lng: 120.9842 };
      const b = { lat: 14.5995001, lng: 120.9842 };
      const distance = haversineDistance(a, b);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(1);
    });

    test('fare calculation handles large distances', () => {
      const taxiRow = {
        "Vehicle Type": "Taxi",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "13.5",
        "Per Minute Travel time": "2"
      };
      const fare = calculateFare(taxiRow, 1000, 120);
      expect(fare).toBeGreaterThan(0);
      expect(fare).toBe(40 + (995 * 13.5) + 240);
    });

    test('jeepney fare handles large distances', () => {
      const fare = calculateJeepneyFare(100);
      expect(fare).toBe(13 + (96 * 2.2));
    });

    test('priority queue handles float priorities', () => {
      const pq = new PriorityQueue();
      pq.enqueue('A', 1.5);
      pq.enqueue('B', 1.2);
      pq.enqueue('C', 1.8);
      expect(pq.dequeue().element).toBe('B');
    });
  });

  // Test Suite 9: Integration Tests
  describe('Integration Scenarios', () => {
    test('complete taxi trip calculation', () => {
      const taxiRow = {
        "Vehicle Type": "Taxi",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "13.5",
        "Per Minute Travel time": "2"
      };
      const distance = 15; // km
      const minutes = 30;
      const fare = calculateFare(taxiRow, distance, minutes);
      expect(fare).toBe(40 + (10 * 13.5) + 60);
    });

    test('complete jeepney trip with transfers', () => {
      const trip1 = calculateJeepneyFare(5);
      const trip2 = calculateJeepneyFare(6);
      const totalFare = trip1 + trip2;
      expect(totalFare).toBeGreaterThan(0);
      expect(totalFare).toBe((13 + 2.2) + (13 + 4.4));
    });

    test('distance and fare relationship is consistent', () => {
      const distances = [5, 10, 15, 20];
      const fares = distances.map(d => calculateJeepneyFare(d));
      for (let i = 1; i < fares.length; i++) {
        expect(fares[i]).toBeGreaterThan(fares[i-1]);
      }
    });
  });

  // Test Suite 10: Boundary Value Tests
  describe('Boundary Values', () => {
    test('fare at exact base distance boundary', () => {
      const taxiRow = {
        "Vehicle Type": "Taxi",
        "Base Rate(First 5 or 4 kilometers)": "40",
        "Rate per km (₱)": "13.5",
        "Per Minute Travel time": "2"
      };
      const fareAt5 = calculateFare(taxiRow, 5, 0);
      const fareAt5Point1 = calculateFare(taxiRow, 5.1, 0);
      expect(fareAt5).toBe(40);
      expect(fareAt5Point1).toBeGreaterThan(40);
    });

    test('jeepney fare at base km boundary', () => {
      const fareAt4 = calculateJeepneyFare(4);
      const fareAt4Point1 = calculateJeepneyFare(4.1);
      expect(fareAt4).toBe(13);
      expect(fareAt4Point1).toBeGreaterThan(13);
    });
  });
});