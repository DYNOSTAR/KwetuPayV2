const { query } = require('../config/database');

const seedSampleData = async () => {
  try {
    console.log('🌱 Seeding sample data...');

    // Create sample landlord
    const landlordResult = await query(
      `INSERT INTO users (first_name, last_name, email, phone_number, password_hash, role) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING user_id`,
      ['John', 'Kamau', 'john.landlord@kwetupay.com', '+254711222333', '$2b$12$hashedpassword', 'landlord']
    );

    const landlordId = landlordResult.rows[0].user_id;

    // Create sample properties
    const properties = [
      {
        title: 'Beautiful 2-Bedroom Apartment in Westlands',
        description: 'Spacious apartment with modern amenities in a secure compound. Perfect for young professionals.',
        property_type: 'apartment',
        rent_amount: 35000,
        bedrooms: 2,
        bathrooms: 2,
        area_sqft: 850,
        address: '123 Westlands Road',
        city: 'Nairobi',
        neighborhood: 'Westlands',
        amenities: {
          wifi: true,
          parking: true,
          water: true,
          electricity: true,
          security: true,
          furnished: true
        }
      },
      {
        title: 'Cozy Studio in Kilimani',
        description: 'Fully furnished studio apartment with great natural light. Walking distance to shops and restaurants.',
        property_type: 'studio',
        rent_amount: 22000,
        bedrooms: 1,
        bathrooms: 1,
        area_sqft: 450,
        address: '456 Kilimani Lane',
        city: 'Nairobi',
        neighborhood: 'Kilimani',
        amenities: {
          wifi: true,
          parking: false,
          water: true,
          electricity: true,
          security: true,
          furnished: true
        }
      },
      {
        title: '3-Bedroom House in Karen',
        description: 'Beautiful family home with garden and ample parking. Quiet neighborhood with good schools nearby.',
        property_type: 'house',
        rent_amount: 75000,
        bedrooms: 3,
        bathrooms: 2,
        area_sqft: 1200,
        address: '789 Karen Road',
        city: 'Nairobi',
        neighborhood: 'Karen',
        amenities: {
          wifi: true,
          parking: true,
          water: true,
          electricity: true,
          security: true,
          furnished: false
        }
      }
    ];

    for (const property of properties) {
      await query(
        `INSERT INTO properties (
          landlord_id, title, description, property_type, rent_amount, currency,
          bedrooms, bathrooms, area_sqft, address, city, neighborhood, amenities
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          landlordId,
          property.title,
          property.description,
          property.property_type,
          property.rent_amount,
          'KES',
          property.bedrooms,
          property.bathrooms,
          property.area_sqft,
          property.address,
          property.city,
          property.neighborhood,
          JSON.stringify(property.amenities)
        ]
      );
    }

    console.log('✅ Sample data seeded successfully!');
    console.log('📧 Test landlord: john.landlord@kwetupay.com');
    console.log('🔑 Password: password123');

  } catch (error) {
    console.error('❌ Error seeding sample data:', error);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  seedSampleData();
}

module.exports = seedSampleData;