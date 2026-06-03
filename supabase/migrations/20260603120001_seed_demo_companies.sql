-- Demo seed data: companies with growth signals for AI scoring
-- Scores are generated at runtime via the AI scoring engine

INSERT INTO public.companies (id, company_name, industry, website, location, description) VALUES
  ('a1000001-0000-4000-8000-000000000001', 'NovaTech Solutions', 'Enterprise Software', 'novatech.io', 'San Francisco, CA', 'Mid-market SaaS provider building workflow automation tools for finance teams.'),
  ('a1000001-0000-4000-8000-000000000002', 'GreenLeaf Logistics', 'Supply Chain', 'greenleaflogistics.com', 'Austin, TX', 'Regional logistics company expanding fleet management and route optimization capabilities.'),
  ('a1000001-0000-4000-8000-000000000003', 'MedSync Health', 'Healthcare IT', 'medsync.health', 'Boston, MA', 'Digital health platform connecting clinics with patient engagement and billing systems.'),
  ('a1000001-0000-4000-8000-000000000004', 'BrightPath Education', 'EdTech', 'brightpath.edu', 'Denver, CO', 'K-12 learning platform scaling personalized curriculum delivery across school districts.'),
  ('a1000001-0000-4000-8000-000000000005', 'CloudForge DevOps', 'Cloud Infrastructure', 'cloudforge.dev', 'Seattle, WA', 'DevOps consultancy helping enterprises migrate and optimize cloud-native architectures.'),
  ('a1000001-0000-4000-8000-000000000006', 'RetailPulse Analytics', 'Retail Tech', 'retailpulse.ai', 'New York, NY', 'Retail analytics startup providing real-time inventory and customer behavior insights.'),
  ('a1000001-0000-4000-8000-000000000007', 'SecureNet Cyber', 'Cybersecurity', 'securenet.io', 'Washington, DC', 'Cybersecurity firm offering threat detection and compliance automation for regulated industries.'),
  ('a1000001-0000-4000-8000-000000000008', 'AgriGrow Systems', 'AgTech', 'agrigrow.farm', 'Des Moines, IA', 'Precision agriculture platform using IoT sensors for crop monitoring and yield optimization.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.signals (company_id, signal_type, signal_title, description, signal_weight, detected_date) VALUES
  ('a1000001-0000-4000-8000-000000000001', 'Funding', 'Series B $45M raised', 'Led by Accel Partners to expand sales team and enter European markets.', 30, now() - interval '5 days'),
  ('a1000001-0000-4000-8000-000000000001', 'Hiring', '12 new sales roles posted', 'VP Sales, Account Executives, and SDR positions across US and EMEA.', 25, now() - interval '3 days'),
  ('a1000001-0000-4000-8000-000000000001', 'Technology Adoption', 'Evaluating CRM migration', 'Job posting mentions Salesforce-to-HubSpot evaluation for sales ops.', 20, now() - interval '1 day'),

  ('a1000001-0000-4000-8000-000000000002', 'Expansion', 'Opened 3 new distribution hubs', 'Expanding into Midwest markets with new warehouse facilities.', 22, now() - interval '10 days'),
  ('a1000001-0000-4000-8000-000000000002', 'Hiring', 'Fleet operations manager role', 'Seeking ops leader to manage 200+ vehicle fleet digitization project.', 18, now() - interval '7 days'),

  ('a1000001-0000-4000-8000-000000000003', 'Product Launch', 'New patient portal launched', 'Self-service portal for appointment scheduling and billing inquiries.', 20, now() - interval '14 days'),
  ('a1000001-0000-4000-8000-000000000003', 'Partnership', 'Partnership with Epic Systems', 'Integration announced for seamless EHR data exchange.', 25, now() - interval '8 days'),
  ('a1000001-0000-4000-8000-000000000003', 'Funding', 'Series A $18M closed', 'Funding to scale sales into regional hospital networks.', 28, now() - interval '20 days'),

  ('a1000001-0000-4000-8000-000000000004', 'Hiring', 'District sales team expansion', '5 regional sales managers hired for back-to-school season push.', 20, now() - interval '6 days'),
  ('a1000001-0000-4000-8000-000000000004', 'Product Launch', 'AI tutoring module beta', 'Beta launch of AI-powered personalized learning paths.', 15, now() - interval '12 days'),

  ('a1000001-0000-4000-8000-000000000005', 'Technology Adoption', 'Kubernetes platform rollout', 'Migrating client workloads to managed Kubernetes across AWS and GCP.', 22, now() - interval '4 days'),
  ('a1000001-0000-4000-8000-000000000005', 'Leadership Change', 'New CRO appointed', 'Former Salesforce executive joins as Chief Revenue Officer.', 18, now() - interval '15 days'),

  ('a1000001-0000-4000-8000-000000000006', 'Funding', 'Seed round $8M', 'Angel and seed investors backing retail analytics expansion.', 25, now() - interval '9 days'),
  ('a1000001-0000-4000-8000-000000000006', 'Hiring', 'Head of Sales search', 'Executive search firm engaged for VP/Head of Sales role.', 22, now() - interval '2 days'),
  ('a1000001-0000-4000-8000-000000000006', 'Expansion', 'NYC flagship office opened', 'New sales office in Manhattan to serve enterprise retail clients.', 20, now() - interval '11 days'),

  ('a1000001-0000-4000-8000-000000000007', 'Partnership', 'AWS security partner status', 'Achieved AWS Advanced Technology Partner for security solutions.', 20, now() - interval '18 days'),
  ('a1000001-0000-4000-8000-000000000007', 'Product Launch', 'Compliance automation suite', 'New SOC 2 and HIPAA compliance automation product released.', 22, now() - interval '5 days'),

  ('a1000001-0000-4000-8000-000000000008', 'Technology Adoption', 'IoT sensor network deployed', 'Deployed 500+ soil sensors across pilot farms in Iowa.', 15, now() - interval '25 days'),
  ('a1000001-0000-4000-8000-000000000008', 'Leadership Change', 'New CEO from John Deere', 'Industry veteran appointed to lead commercial expansion.', 12, now() - interval '30 days');
