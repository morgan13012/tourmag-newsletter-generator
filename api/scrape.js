import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { urls } = req.body;

  if (!urls || !Array.isArray(urls)) {
    return res.status(400).json({ error: 'URLs array is required' });
  }

  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
          });

          const $ = cheerio.load(response.data);
          
          let title = $('meta[property="og:title"]').attr('content') ||
                     $('meta[name="twitter:title"]').attr('content') ||
                     $('h1').first().text().trim() ||
                     $('title').text().trim();

          title = title
            .replace(/\s*[-–|]\s*TourMaG\.com.*$/i, '')
            .replace(/\s*\[ABO\]\s*$/i, ' [ABO]')
            .replace(/\s+/g, ' ')
            .trim();
          
          let image = $('meta[property="og:image"]').attr('content') ||
                     $('meta[name="twitter:image"]').attr('content') ||
                     $('article img').first().attr('src') ||
                     $('img[alt]').first().attr('src');

          if (image && !image.startsWith('http')) {
            const urlObj = new URL(url);
            image = urlObj.origin + (image.startsWith('/') ? '' : '/') + image;
          }

          let alt = '';
          if (image) {
            const imgElement = $(`img[src="${image}"]`).first();
            alt = imgElement.attr('alt') || '';
          }
          
          if (!alt && title) {
            alt = title.substring(0, 100);
          }

          // Extraction du chapô
          let chapo = '';
          const chapoDivs = $('.chapeau h3.access, .chapeau .access, div.chapeau h3');
          if (chapoDivs.length > 0) {
            chapo = chapoDivs.first().text().trim();
            // Ajouter "..." à la fin si pas déjà présent
            if (chapo && !chapo.endsWith('...') && !chapo.endsWith('…')) {
              chapo += '...';
            }
          }

          return {
            url,
            title: title || 'Article sans titre',
            image: image || 'https://via.placeholder.com/215x134',
            alt: alt || 'Image article',
            chapo: chapo || '',
            success: true
          };
        } catch (error) {
          console.error(`Error scraping ${url}:`, error.message);
          return {
            url,
            title: 'Erreur de scraping',
            image: 'https://via.placeholder.com/215x134',
            alt: 'Image non disponible',
            success: false,
            error: error.message
          };
        }
      })
    );

    res.status(200).json({ articles: results });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
