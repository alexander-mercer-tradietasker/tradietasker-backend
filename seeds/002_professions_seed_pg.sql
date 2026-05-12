-- Seed Data: Professions (70 professions from PROFESSIONS_ANALYSIS.md)
-- Created: 2026-05-08

-- ============================================
-- CORE TRADES (Building & Construction)
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Architect', 'core-trades', 1),
('Bricklayer', 'core-trades', 0),
('Builder / General Builder', 'core-trades', 1),
('Carpenter', 'core-trades', 0),
('Cladding Specialist', 'core-trades', 0),
('Concreter', 'core-trades', 0),
('Electrician', 'core-trades', 1),
('Glazier', 'core-trades', 0),
('Painter', 'core-trades', 0),
('Plasterer', 'core-trades', 0),
('Plumber', 'core-trades', 1),
('Roofer', 'core-trades', 0),
('Stonemason', 'core-trades', 0),
('Tiler', 'core-trades', 0),
('Waterproofing Specialist', 'core-trades', 0),
('Welder', 'core-trades', 0);

-- ============================================
-- SPECIALISED CONSTRUCTION
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Asbestos Removal', 'specialised', 1),
('Building Designer / Draftsperson', 'specialised', 0),
('Cabinet Maker', 'specialised', 0),
('Decking Specialist', 'specialised', 0),
('Demolition', 'specialised', 0),
('Earthmoving / Excavator', 'specialised', 0),
('Fencing', 'specialised', 0),
('Fire Protection Installer', 'specialised', 1),
('Flooring Specialist', 'specialised', 0),
('Gas Fitter', 'specialised', 1),
('Insulation Installer', 'specialised', 0),
('Kitchen Renovator', 'specialised', 0),
('Lift/Elevator Technician', 'specialised', 1),
('Paver', 'specialised', 0),
('Renovation Consultant / Project Manager', 'specialised', 0),
('Scaffolder', 'specialised', 0),
('Shop Fitter', 'specialised', 0),
('Signwriter', 'specialised', 0),
('Surveyor', 'specialised', 1),
('Swimming Pool Builder', 'specialised', 1);

-- ============================================
-- BUILDING-ADJACENT TRADES
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Air Conditioning / HVAC Technician', 'adjacent', 1),
('Antenna / AV Specialist', 'adjacent', 0),
('Appliance Repair', 'adjacent', 0),
('Auto Electrician', 'adjacent', 0),
('Blind & Curtain Installer', 'adjacent', 0),
('Chimney Sweep', 'adjacent', 0),
('Drainer', 'adjacent', 0),
('Fascia & Gutter Specialist', 'adjacent', 0),
('Handyman', 'adjacent', 0),
('Home Automation / Security', 'adjacent', 0),
('Locksmith', 'adjacent', 0),
('Pool Maintenance', 'adjacent', 0),
('Security System Installer', 'adjacent', 0),
('Window & Door Installer', 'adjacent', 0);

-- ============================================
-- PROPERTY MAINTENANCE & SERVICES
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Carpet Cleaner', 'maintenance', 0),
('Cleaner (General)', 'maintenance', 0),
('Commercial Cleaner', 'maintenance', 0),
('End of Lease Cleaner', 'maintenance', 0),
('Gardener', 'maintenance', 0),
('House Cleaner', 'maintenance', 0),
('Landscaper', 'maintenance', 0),
('Lawn Care', 'maintenance', 0),
('Pest Control', 'maintenance', 1),
('Property Maintenance', 'maintenance', 0),
('Rubbish Removal', 'maintenance', 0),
('Tree Surgeon / Arborist', 'maintenance', 0),
('Turf Laying', 'maintenance', 0),
('Window Cleaner', 'maintenance', 0);

-- ============================================
-- HOME SERVICES
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Furniture Assembler', 'home-services', 0),
('Interior Designer', 'home-services', 0),
('Removalist', 'home-services', 0),
('Wall Hanging & Mounting', 'home-services', 0);

-- ============================================
-- TRANSPORT & DELIVERY
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Courier', 'transport', 0),
('Delivery Driver', 'transport', 0),
('Driving Services', 'transport', 0),
('Food Delivery', 'transport', 0),
('Grocery Delivery', 'transport', 0);
