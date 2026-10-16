import { describe, it, expect } from 'vitest';
import { SHARED_CAMPUS_LOCATIONS } from '@ecosphere/shared';

describe('Web Application Contract Integrity', () => {
  it('includes all 11 shared campus locations with valid SVG coordinates', () => {
    expect(SHARED_CAMPUS_LOCATIONS).toHaveLength(11);
    const expectedIds = [
      'CLASSROOM_101',
      'CLASSROOM_102',
      'AUDITORIUM_01',
      'CORRIDOR_A1',
      'LAB_CS_01',
      'LAB_PHY_01',
      'CANTEEN_01',
      'LIBRARY_01',
      'HOSTEL_01',
      'SPORTS_01',
      'ACADEMIC_BLOCK_01'
    ];

    for (const id of expectedIds) {
      const loc = SHARED_CAMPUS_LOCATIONS.find(l => l.location_id === id);
      expect(loc).toBeDefined();
      expect(loc?.coordinates.width).toBeGreaterThan(0);
      expect(loc?.coordinates.height).toBeGreaterThan(0);
    }
  });
});
