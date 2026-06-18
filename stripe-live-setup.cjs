/**
 * Praxura — Stripe Live Setup Script
 * Calistirir: node stripe-live-setup.js sk_live_XXXXX
 */

const https = require('https');
const querystring = require('querystring');

const STRIPE_KEY = process.argv[2];

if (!STRIPE_KEY || !STRIPE_KEY.startsWith('sk_live_')) {
  console.error('\nKullanim: node stripe-live-setup.js sk_live_XXXXX\n');
  process.exit(1);
}

function stripe(path, body) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify(body);
    const options = {
      hostname: 'api.stripe.com',
      path: '/v1' + path,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + STRIPE_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error('Stripe ' + path + ': ' + (parsed.error && parsed.error.message)));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('JSON parse error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const PLANS = [
  {
    name:        'Praxura Starter',
    slug:        'STARTER',
    description: 'Fuer Einzelpraxen — Online-Terminbuchung, Patientenakte, 1 Therapeut',
    monthly:     2900,
    yearly:      30000,
  },
  {
    name:        'Praxura Professional',
    slug:        'PROFESSIONAL',
    description: 'Fuer Praxen mit Team — bis 5 Therapeutinnen, KI-Rezeptpruefung, Fahrtenbuch',
    monthly:     4900,
    yearly:      50400,
  },
  {
    name:        'Praxura Klinik',
    slug:        'KLINIK',
    description: 'Maximale Leistung — unbegrenzte Therapeuten, §302 DTA-Abrechnung',
    monthly:     9900,
    yearly:      100800,
  },
];

async function main() {
  console.log('\nPraxura Stripe Live Setup\n');
  var results = {};

  for (var i = 0; i < PLANS.length; i++) {
    var plan = PLANS[i];
    process.stdout.write('-> ' + plan.name + ' olusturuluyor... ');

    var product = await stripe('/products', {
      name: plan.name,
      description: plan.description,
      'metadata[plan_slug]': plan.slug.toLowerCase(),
    });
    console.log('urun OK (' + product.id + ')');

    process.stdout.write('   aylik fiyat (E' + (plan.monthly / 100) + ')... ');
    var monthly = await stripe('/prices', {
      product: product.id,
      unit_amount: plan.monthly,
      currency: 'eur',
      'recurring[interval]': 'month',
      nickname: plan.name + ' Monatlich',
      'metadata[plan_slug]': plan.slug.toLowerCase(),
      'metadata[interval]': 'month',
    });
    console.log('OK (' + monthly.id + ')');

    process.stdout.write('   yillik fiyat (E' + (plan.yearly / 100) + ')... ');
    var yearly = await stripe('/prices', {
      product: product.id,
      unit_amount: plan.yearly,
      currency: 'eur',
      'recurring[interval]': 'year',
      nickname: plan.name + ' Jaehrlich',
      'metadata[plan_slug]': plan.slug.toLowerCase(),
      'metadata[interval]': 'year',
    });
    console.log('OK (' + yearly.id + ')');

    results[plan.slug] = { monthly: monthly.id, yearly: yearly.id };
  }

  console.log('\n' + '='.repeat(64));
  console.log('Vercel Environment Variables - kopyala & yapistir');
  console.log('='.repeat(64));
  console.log('');
  console.log('STRIPE_PRICE_STARTER_MONTHLY=' + results.STARTER.monthly);
  console.log('STRIPE_PRICE_STARTER_YEARLY=' + results.STARTER.yearly);
  console.log('STRIPE_PRICE_PROFESSIONAL_MONTHLY=' + results.PROFESSIONAL.monthly);
  console.log('STRIPE_PRICE_PROFESSIONAL_YEARLY=' + results.PROFESSIONAL.yearly);
  console.log('STRIPE_PRICE_KLINIK_MONTHLY=' + results.KLINIK.monthly);
  console.log('STRIPE_PRICE_KLINIK_YEARLY=' + results.KLINIK.yearly);
  console.log('');
  console.log('='.repeat(64));
  console.log('Elle ekleyeceklerin:');
  console.log('  STRIPE_SECRET_KEY=sk_live_XXXXX');
  console.log('  STRIPE_WEBHOOK_SECRET=whsec_XXXXX');
  console.log('');
  console.log('Webhook URL: https://app.praxura.de/api/stripe/webhook');
  console.log('');
}

main().catch(function(err) {
  console.error('\nHata:', err.message);
  process.exit(1);
});
