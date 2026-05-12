-- Seed Data: Professions (70 professions from PROFESSIONS_ANALYSIS.md)
-- Created: 2026-05-08

-- ============================================
-- CORE TRADES (Building & Construction)
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Architect', 'core-trades',TRUE),
('Bricklayer', 'core-trades',FALSE),
('Builder / General Builder', 'core-trades',TRUE),
('Carpenter', 'core-trades',FALSE),
('Cladding Specialist', 'core-trades',FALSE),
('Concreter', 'core-trades',FALSE),
('Electrician', 'core-trades',TRUE),
('Glazier', 'core-trades',FALSE),
('Painter', 'core-trades',FALSE),
('Plasterer', 'core-trades',FALSE),
('Plumber', 'core-trades',TRUE),
('Roofer', 'core-trades',FALSE),
('Stonemason', 'core-trades',FALSE),
('Tiler', 'core-trades',FALSE),
('Waterproofing Specialist', 'core-trades',FALSE),
('Welder', 'core-trades',FALSE);

-- ============================================
-- SPECIALISED CONSTRUCTION
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Asbestos Removal', 'specialised',TRUE),
('Building Designer / Draftsperson', 'specialised',FALSE),
('Cabinet Maker', 'specialised',FALSE),
('Decking Specialist', 'specialised',FALSE),
('Demolition', 'specialised',FALSE),
('Earthmoving / Excavator', 'specialised',FALSE),
('Fencing', 'specialised',FALSE),
('Fire Protection Installer', 'specialised',TRUE),
('Flooring Specialist', 'specialised',FALSE),
('Gas Fitter', 'specialised',TRUE),
('Insulation Installer', 'specialised',FALSE),
('Kitchen Renovator', 'specialised',FALSE),
('Lift/Elevator Technician', 'specialised',TRUE),
('Paver', 'specialised',FALSE),
('Renovation Consultant / Project Manager', 'specialised',FALSE),
('Scaffolder', 'specialised',FALSE),
('Shop Fitter', 'specialised',FALSE),
('Signwriter', 'specialised',FALSE),
('Surveyor', 'specialised',TRUE),
('Swimming Pool Builder', 'specialised',TRUE);

-- ============================================
-- BUILDING-ADJACENT TRADES
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Air Conditioning / HVAC Technician', 'adjacent',TRUE),
('Antenna / AV Specialist', 'adjacent',FALSE),
('Appliance Repair', 'adjacent',FALSE),
('Auto Electrician', 'adjacent',FALSE),
('Blind & Curtain Installer', 'adjacent',FALSE),
('Chimney Sweep', 'adjacent',FALSE),
('Drainer', 'adjacent',FALSE),
('Fascia & Gutter Specialist', 'adjacent',FALSE),
('Handyman', 'adjacent',FALSE),
('Home Automation / Security', 'adjacent',FALSE),
('Locksmith', 'adjacent',FALSE),
('Pool Maintenance', 'adjacent',FALSE),
('Security System Installer', 'adjacent',FALSE),
('Window & Door Installer', 'adjacent',FALSE);

-- ============================================
-- PROPERTY MAINTENANCE & SERVICES
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Carpet Cleaner', 'maintenance',FALSE),
('Cleaner (General)', 'maintenance',FALSE),
('Commercial Cleaner', 'maintenance',FALSE),
('End of Lease Cleaner', 'maintenance',FALSE),
('Gardener', 'maintenance',FALSE),
('House Cleaner', 'maintenance',FALSE),
('Landscaper', 'maintenance',FALSE),
('Lawn Care', 'maintenance',FALSE),
('Pest Control', 'maintenance',TRUE),
('Property Maintenance', 'maintenance',FALSE),
('Rubbish Removal', 'maintenance',FALSE),
('Tree Surgeon / Arborist', 'maintenance',FALSE),
('Turf Laying', 'maintenance',FALSE),
('Window Cleaner', 'maintenance',FALSE);

-- ============================================
-- HOME SERVICES
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Furniture Assembler', 'home-services',FALSE),
('Interior Designer', 'home-services',FALSE),
('Removalist', 'home-services',FALSE),
('Wall Hanging & Mounting', 'home-services',FALSE);

-- ============================================
-- TRANSPORT & DELIVERY
-- ============================================
INSERT INTO professions (name, category, requires_licence) VALUES
('Courier', 'transport',FALSE),
('Delivery Driver', 'transport',FALSE),
('Driving Services', 'transport',FALSE),
('Food Delivery', 'transport',FALSE),
('Grocery Delivery', 'transport',FALSE);
