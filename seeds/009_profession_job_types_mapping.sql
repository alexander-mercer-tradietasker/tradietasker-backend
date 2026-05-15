-- Seed Data: Profession to Job Type Mapping
-- Comprehensive many-to-many mapping of 70 professions to 100 job types
-- Created: 2026-05-16
-- Based on PROFESSIONS_ANALYSIS.md logical groupings

-- ============================================
-- CORE TRADES MAPPINGS
-- ============================================

-- Architect (ID: 1)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(1, 9),   -- Building Design & Plans
(1, 21),  -- Drafting / Building Plans
(1, 33),  -- Granny Flat Construction
(1, 38),  -- Home Extension
(1, 43),  -- Kitchen Renovation
(1, 46),  -- New Home Build
(1, 54),  -- Renovation (General)
(1, 6);   -- Bathroom Renovation

-- Bricklayer (ID: 2)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(2, 8),   -- Bricklaying
(2, 55),  -- Retaining Wall
(2, 46),  -- New Home Build
(2, 38),  -- Home Extension
(2, 6);   -- Bathroom Renovation

-- Builder / General Builder (ID: 3)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(3, 46),  -- New Home Build
(3, 38),  -- Home Extension
(3, 33),  -- Granny Flat Construction
(3, 54),  -- Renovation (General)
(3, 43),  -- Kitchen Renovation
(3, 6),   -- Bathroom Renovation
(3, 18),  -- Decking Construction
(3, 27),  -- Fencing Installation
(3, 28),  -- Fencing Repair
(3, 55),  -- Retaining Wall
(3, 8),   -- Bricklaying
(3, 17),  -- Concreting (General)
(3, 15),  -- Concrete Driveway
(3, 16);  -- Concrete Slab

-- Carpenter (ID: 4)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(4, 11),  -- Carpentry (General)
(4, 18),  -- Decking Construction
(4, 10),  -- Cabinet Making / Joinery
(4, 27),  -- Fencing Installation
(4, 28),  -- Fencing Repair
(4, 23),  -- Drywall / Plasterboard
(4, 12),  -- Ceiling Repair
(4, 30),  -- Flooring Installation
(4, 20),  -- Door Installation
(4, 69),  -- Window & Door Repair
(4, 46),  -- New Home Build
(4, 38),  -- Home Extension
(4, 54),  -- Renovation (General)
(4, 58),  -- Scaffolding
(4, 35);  -- Handyman Services

-- Cladding Specialist (ID: 5)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(5, 14),  -- Cladding Installation
(5, 46),  -- New Home Build
(5, 38),  -- Home Extension
(5, 54);  -- Renovation (General)

-- Concreter (ID: 6)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(6, 17),  -- Concreting (General)
(6, 15),  -- Concrete Driveway
(6, 16),  -- Concrete Slab
(6, 48),  -- Paving
(6, 55),  -- Retaining Wall
(6, 44),  -- Landscaping (Construction)
(6, 46),  -- New Home Build
(6, 38);  -- Home Extension

-- Electrician (ID: 7)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(7, 25),  -- Electrical Installation
(7, 26),  -- Electrical Repair
(7, 36),  -- Heating Installation
(7, 1),   -- Air Conditioning Installation
(7, 2),   -- Air Conditioning Repair
(7, 37),  -- Home Automation
(7, 39),  -- Home Theatre Installation
(7, 59),  -- Security System Installation
(7, 3),   -- Appliance Installation
(7, 4),   -- Appliance Repair
(7, 43),  -- Kitchen Renovation
(7, 6),   -- Bathroom Renovation
(7, 46),  -- New Home Build
(7, 38),  -- Home Extension
(7, 54);  -- Renovation (General)

-- Glazier (ID: 8)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(8, 32),  -- Glazing / Window Repair
(8, 68),  -- Window Installation
(8, 69),  -- Window & Door Repair
(8, 20);  -- Door Installation

-- Painter (ID: 9)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(9, 40),  -- House Painting (Exterior)
(9, 41),  -- House Painting (Interior)
(9, 47),  -- Painting (Commercial)
(9, 53),  -- Rendering
(9, 6),   -- Bathroom Renovation
(9, 43),  -- Kitchen Renovation
(9, 54),  -- Renovation (General)
(9, 46),  -- New Home Build
(9, 38);  -- Home Extension

-- Plasterer (ID: 10)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(10, 49),  -- Plastering
(10, 23),  -- Drywall / Plasterboard
(10, 12),  -- Ceiling Repair
(10, 53),  -- Rendering
(10, 46),  -- New Home Build
(10, 38),  -- Home Extension
(10, 54);  -- Renovation (General)

-- Plumber (ID: 11)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(11, 50),  -- Plumbing Installation
(11, 51),  -- Plumbing Repair
(11, 22),  -- Drainage Work
(11, 31),  -- Gas Fitting
(11, 6),   -- Bathroom Renovation
(11, 43),  -- Kitchen Renovation
(11, 34),  -- Guttering
(11, 46),  -- New Home Build
(11, 38),  -- Home Extension
(11, 54),  -- Renovation (General)
(11, 52);  -- Pool Construction

-- Roofer (ID: 12)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(12, 56),  -- Roofing Installation
(12, 57),  -- Roofing Repair
(12, 34),  -- Guttering
(12, 46),  -- New Home Build
(12, 38),  -- Home Extension
(12, 54);  -- Renovation (General)

-- Stonemason (ID: 13)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(13, 62),  -- Stonework
(13, 55),  -- Retaining Wall
(13, 48),  -- Paving
(13, 6),   -- Bathroom Renovation
(13, 43);  -- Kitchen Renovation

-- Tiler (ID: 14)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(14, 64),  -- Tiling
(14, 6),   -- Bathroom Renovation
(14, 43),  -- Kitchen Renovation
(14, 54),  -- Renovation (General)
(14, 30),  -- Flooring Installation
(14, 66);  -- Waterproofing

-- Waterproofing Specialist (ID: 15)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(15, 66),  -- Waterproofing
(15, 6),   -- Bathroom Renovation
(15, 52);  -- Pool Construction

-- Welder (ID: 16)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(16, 67),  -- Welding
(16, 27),  -- Fencing Installation
(16, 28),  -- Fencing Repair
(16, 55),  -- Retaining Wall
(16, 58);  -- Scaffolding

-- ============================================
-- SPECIALISED CONSTRUCTION MAPPINGS
-- ============================================

-- Asbestos Removal (ID: 17)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(17, 5),   -- Asbestos Removal
(17, 19),  -- Demolition
(17, 54);  -- Renovation (General)

-- Building Designer / Draftsperson (ID: 18)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(18, 9),   -- Building Design & Plans
(18, 21),  -- Drafting / Building Plans
(18, 33),  -- Granny Flat Construction
(18, 38),  -- Home Extension
(18, 43),  -- Kitchen Renovation
(18, 46);  -- New Home Build

-- Cabinet Maker (ID: 19)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(19, 10),  -- Cabinet Making / Joinery
(19, 43),  -- Kitchen Renovation
(19, 6),   -- Bathroom Renovation
(19, 54),  -- Renovation (General)
(19, 11);  -- Carpentry (General)

-- Decking Specialist (ID: 20)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(20, 18),  -- Decking Construction
(20, 44);  -- Landscaping (Construction)

-- Demolition (ID: 21)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(21, 19),  -- Demolition
(21, 5),   -- Asbestos Removal
(21, 54),  -- Renovation (General)
(21, 65);  -- Wall Removal / Opening

-- Earthmoving / Excavator (ID: 22)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(22, 24),  -- Earthmoving / Excavation
(22, 15),  -- Concrete Driveway
(22, 16),  -- Concrete Slab
(22, 44),  -- Landscaping (Construction)
(22, 52),  -- Pool Construction
(22, 55),  -- Retaining Wall
(22, 46);  -- New Home Build

-- Fencing (ID: 23)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(23, 27),  -- Fencing Installation
(23, 28),  -- Fencing Repair
(23, 52);  -- Pool Construction

-- Fire Protection Installer (ID: 24)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(24, 29),  -- Fire Protection Systems
(24, 46),  -- New Home Build
(24, 60);  -- Shop Fitting

-- Flooring Specialist (ID: 25)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(25, 30),  -- Flooring Installation
(25, 54),  -- Renovation (General)
(25, 43),  -- Kitchen Renovation
(25, 6);   -- Bathroom Renovation

-- Gas Fitter (ID: 26)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(26, 31),  -- Gas Fitting
(26, 36),  -- Heating Installation
(26, 43),  -- Kitchen Renovation
(26, 46),  -- New Home Build
(26, 54);  -- Renovation (General)

-- Insulation Installer (ID: 27)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(27, 42),  -- Insulation Installation
(27, 46),  -- New Home Build
(27, 38),  -- Home Extension
(27, 54);  -- Renovation (General)

-- Kitchen Renovator (ID: 28)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(28, 43),  -- Kitchen Renovation
(28, 10),  -- Cabinet Making / Joinery
(28, 64),  -- Tiling
(28, 50),  -- Plumbing Installation
(28, 25),  -- Electrical Installation
(28, 41),  -- House Painting (Interior)
(28, 30);  -- Flooring Installation

-- Lift/Elevator Technician (ID: 29)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(29, 45);  -- Lift/Elevator Service

-- Paver (ID: 30)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(30, 48),  -- Paving
(30, 15),  -- Concrete Driveway
(30, 44),  -- Landscaping (Construction)
(30, 18);  -- Decking Construction

-- Renovation Consultant / Project Manager (ID: 31)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(31, 54),  -- Renovation (General)
(31, 43),  -- Kitchen Renovation
(31, 6),   -- Bathroom Renovation
(31, 38),  -- Home Extension
(31, 46);  -- New Home Build

-- Scaffolder (ID: 32)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(32, 58),  -- Scaffolding
(32, 46),  -- New Home Build
(32, 56),  -- Roofing Installation
(32, 40);  -- House Painting (Exterior)

-- Shop Fitter (ID: 33)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(33, 60),  -- Shop Fitting
(33, 10),  -- Cabinet Making / Joinery
(33, 25);  -- Electrical Installation

-- Signwriter (ID: 34)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(34, 61);  -- Signage Installation

-- Surveyor (ID: 35)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(35, 63),  -- Surveying
(35, 46),  -- New Home Build
(35, 38);  -- Home Extension

-- Swimming Pool Builder (ID: 36)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(36, 52),  -- Pool Construction
(36, 66),  -- Waterproofing
(36, 27),  -- Fencing Installation
(36, 24);  -- Earthmoving / Excavation

-- ============================================
-- BUILDING-ADJACENT TRADES MAPPINGS
-- ============================================

-- Air Conditioning / HVAC Technician (ID: 37)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(37, 1),   -- Air Conditioning Installation
(37, 2),   -- Air Conditioning Repair
(37, 36);  -- Heating Installation

-- Antenna / AV Specialist (ID: 38)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(38, 39);  -- Home Theatre Installation

-- Appliance Repair (ID: 39)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(39, 3),   -- Appliance Installation
(39, 4);   -- Appliance Repair

-- Auto Electrician (ID: 40)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(40, 25),  -- Electrical Installation
(40, 26);  -- Electrical Repair

-- Blind & Curtain Installer (ID: 41)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(41, 7);   -- Blind & Curtain Installation

-- Chimney Sweep (ID: 42)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(42, 13);  -- Chimney Cleaning & Repair

-- Drainer (ID: 43)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(43, 22),  -- Drainage Work
(43, 51);  -- Plumbing Repair

-- Fascia & Gutter Specialist (ID: 44)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(44, 34),  -- Guttering
(44, 57);  -- Roofing Repair

-- Handyman (ID: 45)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(45, 35),  -- Handyman Services
(45, 85),  -- Property Maintenance
(45, 74),  -- Furniture Assembly
(45, 91),  -- Wall Hanging / TV Mounting
(45, 69),  -- Window & Door Repair
(45, 28),  -- Fencing Repair
(45, 12),  -- Ceiling Repair
(45, 26);  -- Electrical Repair

-- Home Automation / Security (ID: 46)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(46, 37),  -- Home Automation
(46, 59);  -- Security System Installation

-- Locksmith (ID: 47)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(47, 59),  -- Security System Installation
(47, 20);  -- Door Installation

-- Pool Maintenance (ID: 48)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(48, 83),  -- Pool Cleaning
(48, 84);  -- Pool Maintenance

-- Security System Installer (ID: 49)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(49, 59),  -- Security System Installation
(49, 37);  -- Home Automation

-- Window & Door Installer (ID: 50)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(50, 68),  -- Window Installation
(50, 69),  -- Window & Door Repair
(50, 20),  -- Door Installation
(50, 32);  -- Glazing / Window Repair

-- ============================================
-- PROPERTY MAINTENANCE & SERVICES MAPPINGS
-- ============================================

-- Carpet Cleaner (ID: 51)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(51, 70),  -- Carpet Cleaning
(51, 72),  -- End of Lease Cleaning
(51, 88);  -- Spring Cleaning

-- Cleaner (General) (ID: 52)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(52, 77),  -- House Cleaning
(52, 71),  -- Commercial Cleaning
(52, 72),  -- End of Lease Cleaning
(52, 88);  -- Spring Cleaning

-- Commercial Cleaner (ID: 53)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(53, 71),  -- Commercial Cleaning
(53, 77);  -- House Cleaning

-- End of Lease Cleaner (ID: 54)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(54, 72),  -- End of Lease Cleaning
(54, 70),  -- Carpet Cleaning
(54, 77),  -- House Cleaning
(54, 88);  -- Spring Cleaning

-- Gardener (ID: 55)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(55, 76),  -- Garden Maintenance
(55, 77),  -- Gardening (General)
(55, 78),  -- Lawn Mowing
(55, 85),  -- Pruning / Tree Trimming
(55, 90);  -- Turf Laying

-- House Cleaner (ID: 56)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(56, 77),  -- House Cleaning
(56, 72),  -- End of Lease Cleaning
(56, 88),  -- Spring Cleaning
(56, 70);  -- Carpet Cleaning

-- Landscaper (ID: 57)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(57, 44),  -- Landscaping (Construction)
(57, 79),  -- Landscaping (Softscaping)
(57, 75),  -- Garden Design
(57, 76),  -- Garden Maintenance
(57, 48),  -- Paving
(57, 55),  -- Retaining Wall
(57, 90),  -- Turf Laying
(57, 18);  -- Decking Construction

-- Lawn Care (ID: 58)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(58, 78),  -- Lawn Mowing
(58, 76),  -- Garden Maintenance
(58, 90);  -- Turf Laying

-- Pest Control (ID: 59)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(59, 80),  -- Pest Control
(59, 81);  -- Pest Inspection

-- Property Maintenance (ID: 60)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(60, 85),  -- Property Maintenance
(60, 35),  -- Handyman Services
(60, 76),  -- Garden Maintenance
(60, 78),  -- Lawn Mowing
(60, 77),  -- House Cleaning
(60, 91),  -- Wall Hanging / TV Mounting
(60, 74);  -- Furniture Assembly

-- Rubbish Removal (ID: 61)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(61, 87),  -- Rubbish Removal
(61, 92),  -- Waste Removal
(61, 100); -- Junk Removal

-- Tree Surgeon / Arborist (ID: 62)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(62, 88),  -- Tree Removal
(62, 85);  -- Pruning / Tree Trimming

-- Turf Laying (ID: 63)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(63, 90),  -- Turf Laying
(63, 79);  -- Landscaping (Softscaping)

-- Window Cleaner (ID: 64)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(64, 93);  -- Window Cleaning

-- ============================================
-- HOME SERVICES MAPPINGS
-- ============================================

-- Furniture Assembler (ID: 65)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(65, 74),  -- Furniture Assembly
(65, 91);  -- Wall Hanging / TV Mounting

-- Interior Designer (ID: 66)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(66, 75),  -- Garden Design
(66, 43),  -- Kitchen Renovation
(66, 6),   -- Bathroom Renovation
(66, 54);  -- Renovation (General)

-- Removalist (ID: 67)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(67, 99),  -- House/Office Moving
(67, 98);  -- Furniture Removal

-- Wall Hanging & Mounting (ID: 68)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(68, 91),  -- Wall Hanging / TV Mounting
(68, 39);  -- Home Theatre Installation

-- ============================================
-- TRANSPORT & DELIVERY MAPPINGS
-- ============================================

-- Courier (ID: 69)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(69, 93),  -- Courier / Parcel Delivery
(69, 94);  -- Delivery (General)

-- Delivery Driver (ID: 70)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(70, 94),  -- Delivery (General)
(70, 96),  -- Food Delivery
(70, 98);  -- Grocery Delivery

-- Driving Services (ID: 71)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(71, 95);  -- Driving Services

-- Food Delivery (ID: 72)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(72, 96);  -- Food Delivery

-- Grocery Delivery (ID: 73)
INSERT INTO profession_job_types (profession_id, job_type_id) VALUES
(73, 98);  -- Grocery Delivery

