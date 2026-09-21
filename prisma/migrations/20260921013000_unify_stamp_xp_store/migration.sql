UPDATE "RewardItem"
SET "redemptionMode" = 'ELIGIBILITY', "xpCost" = 0
WHERE lower("name") = 'chaveiro';

UPDATE "RewardItem"
SET "redemptionMode" = 'XP_STORE',
    "xpCost" = CASE lower("name")
      WHEN 'caneta' THEN 200
      WHEN 'bloco' THEN 200
      WHEN 'botton' THEN 300
      WHEN 'ecobag' THEN 400
      WHEN 'garrafa' THEN 500
      ELSE "xpCost"
    END
WHERE lower("name") IN ('caneta', 'bloco', 'botton', 'ecobag', 'garrafa');
