# Country links for the globe: for each market, a US-listed country ETF (the
# "is this country up or down" proxy, priced in USD), the local companies that
# move that market, and the US-tradable stocks tied to them.
#
#   local: companies headquartered there. 'sym' is a US-tradable ticker
#          (NYSE/Nasdaq listing, ADR, or OTC ADR) or None if there isn't one.
#   us:    US-tradable stocks with a documented business link to that market's
#          companies (customer, supplier, competitor, parent). 'why' says which.
#
# Every symbol was checked as tradable on Robinhood when this list was
# written (Sept 2026). Relationships are general business facts, not trade
# ideas. Keep 'why' lines short, factual and free of predictions.

COUNTRIES = {
 'USA': {'name': 'United States', 'etf': 'SPY', 'etf_label': 'S&P 500 (SPY)',
   'local': [('NVIDIA', 'NVDA'), ('Apple', 'AAPL'), ('Microsoft', 'MSFT'), ('Amazon', 'AMZN'), ('Alphabet', 'GOOGL')],
   'us': []},
 'CAN': {'name': 'Canada', 'etf': 'EWC', 'local': [('Shopify', 'SHOP'), ('Royal Bank of Canada', 'RY'), ('Enbridge', 'ENB'), ('Canadian Natural Resources', 'CNQ')],
   'us': [('WMT', 'Shopify competes with US e-commerce platforms'), ('XOM', 'Canadian oil sands producers price off the same crude benchmarks')]},
 'MEX': {'name': 'Mexico', 'etf': 'EWW', 'local': [('América Móvil', 'AMX'), ('FEMSA', 'FMX'), ('Grupo Televisa', 'TV')],
   'us': [('CP', 'Canadian Pacific Kansas City runs the main US–Mexico rail line'), ('GM', 'Large vehicle assembly base in Mexico')]},
 'BRA': {'name': 'Brazil', 'etf': 'EWZ', 'local': [('Petrobras', 'PBR'), ('Vale', 'VALE'), ('Itaú Unibanco', 'ITUB'), ('Nu Holdings', 'NU')],
   'us': [('FCX', 'Copper and iron-ore peer of Vale'), ('XOM', 'Offshore oil peer of Petrobras')]},
 'ARG': {'name': 'Argentina', 'etf': 'ARGT', 'local': [('MercadoLibre', 'MELI'), ('YPF', 'YPF'), ('Grupo Galicia', 'GGAL')],
   'us': [('AMZN', 'Competes with MercadoLibre in Latin American e-commerce')]},
 'CHL': {'name': 'Chile', 'etf': 'ECH', 'local': [('SQM', 'SQM')],
   'us': [('ALB', 'Lithium producer with Chilean operations, SQM\'s main rival'), ('FCX', 'Copper price exposure shared with Chile\'s miners')]},
 'GBR': {'name': 'United Kingdom', 'etf': 'EWU', 'local': [('AstraZeneca', 'AZN'), ('Shell', 'SHEL'), ('HSBC', 'HSBC'), ('Arm Holdings', 'ARM'), ('Unilever', 'UL')],
   'us': [('NVDA', 'Licenses Arm\'s chip architecture'), ('QCOM', 'Licenses Arm\'s chip architecture')]},
 'DEU': {'name': 'Germany', 'etf': 'EWG', 'local': [('SAP', 'SAP'), ('Siemens', 'SIEGY'), ('Deutsche Bank', 'DB')],
   'us': [('ORCL', 'Enterprise software rival of SAP'), ('GE', 'Industrial peer of Siemens')]},
 'FRA': {'name': 'France', 'etf': 'EWQ', 'local': [('TotalEnergies', 'TTE'), ('Sanofi', 'SNY')],
   'us': [('XOM', 'Integrated oil peer of TotalEnergies')]},
 'NLD': {'name': 'Netherlands', 'etf': 'EWN', 'local': [('ASML', 'ASML'), ('NXP Semiconductors', 'NXPI')],
   'us': [('TSM', 'Largest customer for ASML\'s lithography tools'), ('INTC', 'Buys ASML lithography tools'), ('AMAT', 'Chip-equipment peer of ASML')]},
 'CHE': {'name': 'Switzerland', 'etf': 'EWL', 'local': [('Nestlé', 'NSRGY'), ('Roche', 'RHHBY'), ('Novartis', 'NVS'), ('UBS', 'UBS')],
   'us': [('PFE', 'Pharma peer of Roche and Novartis'), ('MDLZ', 'Packaged-food peer of Nestlé')]},
 'DNK': {'name': 'Denmark', 'etf': 'EDEN', 'local': [('Novo Nordisk', 'NVO')],
   'us': [('LLY', 'Main competitor in GLP-1 weight-loss and diabetes drugs')]},
 'SWE': {'name': 'Sweden', 'etf': 'EWD', 'local': [('Spotify', 'SPOT'), ('Ericsson', 'ERIC')],
   'us': [('NOK', 'Telecom-equipment peer of Ericsson')]},
 'NOR': {'name': 'Norway', 'etf': 'ENOR', 'local': [('Equinor', 'EQNR')], 'us': [('XOM', 'Oil and gas peer of Equinor')]},
 'ESP': {'name': 'Spain', 'etf': 'EWP', 'local': [('Banco Santander', 'SAN'), ('Telefónica', None)], 'us': []},
 'ITA': {'name': 'Italy', 'etf': 'EWI', 'local': [('Ferrari', 'RACE'), ('Eni', 'E')], 'us': []},
 'POL': {'name': 'Poland', 'etf': 'EPOL', 'local': [], 'us': []},
 'TUR': {'name': 'Turkey', 'etf': 'TUR', 'local': [], 'us': []},
 'ISR': {'name': 'Israel', 'etf': 'EIS', 'local': [('Check Point', 'CHKP'), ('Teva', 'TEVA'), ('monday.com', 'MNDY'), ('Wix', 'WIX')],
   'us': [('PANW', 'Cybersecurity peer of Check Point'), ('CRWD', 'Cybersecurity peer of Check Point')]},
 'SAU': {'name': 'Saudi Arabia', 'etf': 'KSA', 'local': [('Saudi Aramco', None)],
   'us': [('XOM', 'Oil prices are heavily influenced by Saudi output decisions'), ('CVX', 'Oil prices are heavily influenced by Saudi output decisions')]},
 'ZAF': {'name': 'South Africa', 'etf': 'EZA', 'local': [('Gold Fields', 'GFI'), ('Sibanye Stillwater', 'SBSW')],
   'us': [('NEM', 'Gold-mining peer; moves with the same gold price')]},
 'IND': {'name': 'India', 'etf': 'INDA', 'local': [('Infosys', 'INFY'), ('HDFC Bank', 'HDB'), ('ICICI Bank', 'IBN'), ('Wipro', 'WIT')],
   'us': [('ACN', 'IT-services competitor of Infosys and Wipro'), ('CTSH', 'IT-services competitor with large Indian operations')]},
 'CHN': {'name': 'China', 'etf': 'MCHI', 'local': [('Alibaba', 'BABA'), ('Tencent', 'TCEHY'), ('PDD Holdings', 'PDD'), ('BYD', 'BYDDY'), ('JD.com', 'JD')],
   'us': [('TSLA', 'Competes with BYD in electric vehicles'), ('AAPL', 'Large share of iPhone sales and assembly in China'), ('QCOM', 'Chinese phone makers are major customers')]},
 'TWN': {'name': 'Taiwan', 'etf': 'EWT', 'local': [('TSMC', 'TSM'), ('UMC', 'UMC'), ('ASE Technology', 'ASX')],
   'us': [('NVDA', 'TSMC manufactures NVIDIA\'s chips'), ('AAPL', 'TSMC manufactures Apple\'s chips'), ('AMD', 'TSMC manufactures AMD\'s chips')]},
 'KOR': {'name': 'South Korea', 'etf': 'EWY', 'local': [('SK hynix', 'SKHY'), ('Samsung Electronics', None), ('KB Financial', 'KB'), ('POSCO', 'PKX'), ('Coupang', 'CPNG')],
   'us': [('MU', 'Memory-chip competitor of SK hynix and Samsung'), ('NVDA', 'Buys high-bandwidth memory (HBM) from SK hynix'), ('SNDK', 'Flash-memory peer of Samsung and SK hynix')]},
 'JPN': {'name': 'Japan', 'etf': 'EWJ', 'local': [('Toyota', 'TM'), ('Sony', 'SONY'), ('Mitsubishi UFJ', 'MUFG'), ('Tokyo Electron', 'TELWY'), ('SoftBank Group', 'SFTBY')],
   'us': [('ARM', 'Majority-owned by SoftBank Group'), ('AMAT', 'Chip-equipment competitor of Tokyo Electron'), ('LRCX', 'Chip-equipment competitor of Tokyo Electron')]},
 'AUS': {'name': 'Australia', 'etf': 'EWA', 'local': [('BHP', 'BHP'), ('Rio Tinto', 'RIO')],
   'us': [('FCX', 'Copper-mining peer of BHP and Rio Tinto'), ('CLF', 'Iron-ore and steel exposure')]},
 'IDN': {'name': 'Indonesia', 'etf': 'EIDO', 'local': [], 'us': []},
 'THA': {'name': 'Thailand', 'etf': 'THD', 'local': [], 'us': []},
 'MYS': {'name': 'Malaysia', 'etf': 'EWM', 'local': [], 'us': []},
 'PHL': {'name': 'Philippines', 'etf': 'EPHE', 'local': [], 'us': []},
 'VNM': {'name': 'Vietnam', 'etf': 'VNM', 'local': [], 'us': [('NKE', 'Vietnam is Nike\'s largest footwear production base')]},
 'NZL': {'name': 'New Zealand', 'etf': 'ENZL', 'local': [], 'us': []},
 'IRL': {'name': 'Ireland', 'etf': 'EIRL', 'local': [('Ryanair', 'RYAAY'), ('CRH', 'CRH')], 'us': []},
 'BEL': {'name': 'Belgium', 'etf': 'EWK', 'local': [('Anheuser-Busch InBev', 'BUD')], 'us': [('TAP', 'Beer competitor of AB InBev')]},
 'AUT': {'name': 'Austria', 'etf': 'EWO', 'local': [], 'us': []},
 'FIN': {'name': 'Finland', 'etf': 'EFNL', 'local': [('Nokia', 'NOK')], 'us': [('ERIC', 'Telecom-equipment peer of Nokia')]},
 'COL': {'name': 'Colombia', 'etf': None, 'local': [('Ecopetrol', 'EC')], 'us': []},
 'PER': {'name': 'Peru', 'etf': 'EPU', 'local': [('Southern Copper', 'SCCO'), ('Credicorp', 'BAP')], 'us': [('FCX', 'Copper-mining peer')]},
}
