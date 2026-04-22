const express = require('express');
const cors = require('cors');
const { wrapper } = require('axios-cookiejar-support');
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(cors({ limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = {}; // Almacenamiento temporal de sesiones

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    try {
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar }));

        // 1. Obtener la página de login
        const loginUrl = 'http://201.131.132.7/utsyn/glogin.aspx';
        const loginPage = await client.get(loginUrl);
        let $ = cheerio.load(loginPage.data);

        const viewState = $('#__VIEWSTATE').val();
        const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();
        const eventValidation = $('#__EVENTVALIDATION').val();

        // 2. Hacer el POST del login
        const loginData = new URLSearchParams();
        loginData.append('__VIEWSTATE', viewState);
        loginData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
        loginData.append('__EVENTVALIDATION', eventValidation);
        loginData.append('ctl00$contentCentral$txtusuario', username);
        loginData.append('ctl00$contentCentral$txtpwd', password);
        loginData.append('ctl00$contentCentral$btningresar', 'Iniciar sesión');

        await client.post(loginUrl, loginData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': loginUrl
            }
        });

        // 3. Extraer Calificaciones del Cuatrimestre Actual
        const gradesUrl = 'http://201.131.132.7/utsyn/synstu/currentstu.aspx';
        const gradesResponse = await client.get(gradesUrl);
        $ = cheerio.load(gradesResponse.data);
        
        if ($('#contenidocentral_lblnombreAlumno').length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas o error de conexión' });
        }

        const studentName = $('#contenidocentral_lblnombreAlumno').text().trim();
        const studentCareer = $('#contenidocentral_lblcarrera').text().trim();
        const currentSubjects = [];

        // 3.1 Extraer la url de la foto
        let photoBase64 = null;
        const photoSrc = $('#contenidocentral_btnimgUsuario').attr('src');
        if (photoSrc) {
            try {
                // Puede ser una url relativa como "currentstu.aspx_files/1182181785.JPG" o absoluta
                // Usualmente en la UTZMG es algo como "1182181785.JPG" o una ruta relativa a /utsyn/synstu/
                // Para asegurarnos, construimos la ruta base
                const baseUrl = 'http://201.131.132.7/utsyn/synstu/';
                const photoFullUrl = photoSrc.startsWith('http') ? photoSrc : baseUrl + photoSrc;
                
                const photoResponse = await client.get(photoFullUrl, { responseType: 'arraybuffer' });
                const base64 = Buffer.from(photoResponse.data, 'binary').toString('base64');
                const contentType = photoResponse.headers['content-type'] || 'image/jpeg';
                photoBase64 = `data:${contentType};base64,${base64}`;
            } catch (err) {
                console.error("No se pudo cargar la foto:", err.message);
            }
        }

        $('table.folder_view').each((index, el) => {
            const subjectName = $(el).find(`span[id^="contenidocentral_dlevalCont_lbl_materia_"]`).text().trim();
            if (!subjectName) return;

            const units = [];
            const gradesTable = $(el).find('table[id^="contenidocentral_dlevalCont_gv_calificaciones_"]');
            
            gradesTable.find('tr.gvrow').each((i, tr) => {
                const tds = $(tr).find('td');
                if (tds.length >= 2) {
                    const unitName = $(tds[0]).text().trim();
                    const grade = $(tds[1]).text().trim();
                    
                    if (['AU', 'DE', 'SA', 'NA', 'CA', 'AC'].includes(grade)) {
                        units.push({
                            id: `unit-${index}-${i}`,
                            name: unitName,
                            grade: grade
                        });
                    }
                }
            });

            currentSubjects.push({
                id: `subj-${index}`,
                name: subjectName,
                units: units
            });
        });

        // 4. Extraer Kardex
        const kardexUrl = 'http://201.131.132.7/utsyn/synstu/kardexev.aspx';
        const kardexResponse = await client.get(kardexUrl);
        const $kardex = cheerio.load(kardexResponse.data);
        
        const kardexCycles = [];

        $kardex('table.folder_view').each((index, el) => {
            const cycleName = $kardex(el).find(`span[id^="contenidocentral_dlkardex_lbl_ciclo_"]`).text().trim();
            if (!cycleName) return;

            const subjects = [];
            const gradesTable = $kardex(el).find('table[id^="contenidocentral_dlkardex_gv_calificaciones_"]');
            
            gradesTable.find('tr.gvrow').each((i, tr) => {
                const tds = $kardex(tr).find('td');
                if (tds.length >= 2) {
                    const subjectName = $kardex(tds[0]).text().trim();
                    const grade = $kardex(tds[1]).text().trim();
                    
                    if (['AU', 'DE', 'SA', 'NA', 'CA', 'AC'].includes(grade)) {
                        subjects.push({
                            id: `k-subj-${index}-${i}`,
                            name: subjectName,
                            grade: grade
                        });
                    }
                }
            });

            kardexCycles.push({
                id: `cycle-${index}`,
                name: cycleName,
                subjects: subjects
            });
        });

        // 5. Extraer Mis Datos (updata.aspx)
        const updataUrl = 'http://201.131.132.7/utsyn/synstu/updata.aspx';
        const updataResponse = await client.get(updataUrl);
        const $updata = cheerio.load(updataResponse.data);

        const personalData = {
            apellidoPaterno: $updata('#contenidocentral_txtapellidoPaterno').val(),
            apellidoMaterno: $updata('#contenidocentral_txtapellidoMaterno').val(),
            nombres: $updata('#contenidocentral_txtnombres').val(),
            sexo: $updata('#contenidocentral_ddlsexo option:selected').text(),
            curp: $updata('#contenidocentral_txtcurp').val(),
            domicilio: $updata('#contenidocentral_txtdomicilio').val(),
            colonia: $updata('#contenidocentral_txtcolonia').val(),
            municipio: $updata('#contenidocentral_txtmunicipio').val(),
            codigoPostal: $updata('#contenidocentral_txtcodigoPostal').val(),
            telefono: $updata('#contenidocentral_txttelefono').val(),
            movil: $updata('#contenidocentral_txtmovil').val(),
            correoInstitucional: $updata('#contenidocentral_txtcorreoInstitucional').val(),
            tipoSangre: $updata('#contenidocentral_ddltipoSangre option:selected').text(),
        };

        // 6. Extraer Estatus de Cuenta (accountm.aspx)
        const accountmUrl = 'http://201.131.132.7/utsyn/synstu/accountm.aspx';
        const accountmResponse = await client.get(accountmUrl);
        const $accountm = cheerio.load(accountmResponse.data);

        const accountStatus = {
            total: $accountm('#contenidocentral_lbltotalDebe').text().replace('Total a pagar: ', '').trim(),
            debts: []
        };

        $accountm('#contenidocentral_gvalumnoAdeudo tr').each((i, tr) => {
            // Ignorar encabezados
            if (i === 0 || $accountm(tr).hasClass('GridPager')) return;

            const tds = $accountm(tr).find('td');
            if (tds.length >= 8) {
                accountStatus.debts.push({
                    concepto: $accountm(tds[0]).text().trim(),
                    generado: $accountm(tds[1]).text().trim(),
                    limite: $accountm(tds[2]).text().trim(),
                    original: $accountm(tds[3]).text().trim(),
                    descuento: $accountm(tds[4]).text().trim(),
                    aPagar: $accountm(tds[5]).text().trim(),
                    pagado: $accountm(tds[6]).text().trim(),
                    ciclo: $accountm(tds[7]).text().trim(),
                });
            }
        });

        res.json({
            student: {
                name: studentName,
                career: studentCareer,
                photoBase64: photoBase64
            },
            currentSubjects: currentSubjects,
            kardex: kardexCycles,
            personalData: personalData,
            accountStatus: accountStatus
        });

        // Guardar sesion para descargas futuras (ej. PDF)
        sessions[username] = jar;

    } catch (error) {
        console.error("Error scraping UTSyn:", error.message);
        res.status(500).json({ error: 'Error interno conectando con el portal de la universidad' });
    }
});

app.post('/api/print-order', async (req, res) => {
    const { username } = req.body;

    if (!username || !sessions[username]) {
        return res.status(401).json({ error: 'Sesión expirada o no encontrada. Por favor, vuelve a iniciar sesión.' });
    }

    try {
        const jar = sessions[username];
        const client = wrapper(axios.create({ jar }));
        const accountmUrl = 'http://201.131.132.7/utsyn/synstu/accountm.aspx';

        // 1. Obtener los ViewStates actuales de la pagina de cuenta
        const accountPage = await client.get(accountmUrl);
        const $ = cheerio.load(accountPage.data);
        const viewState = $('#__VIEWSTATE').val();
        const viewStateGenerator = $('#__VIEWSTATEGENERATOR').val();
        const eventValidation = $('#__EVENTVALIDATION').val();

        // 2. Hacer POST simulando el clic del boton "Impresión de orden"
        const printData = new URLSearchParams();
        printData.append('__VIEWSTATE', viewState);
        printData.append('__VIEWSTATEGENERATOR', viewStateGenerator);
        printData.append('__EVENTVALIDATION', eventValidation);
        printData.append('ctl00$contenidocentral$btnimprimirOrdenPago', 'Impresión de orden');

        const pdfResponse = await client.post(accountmUrl, printData.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': accountmUrl
            },
            responseType: 'arraybuffer' // Asegurarnos de recibir el PDF binario
        });

        // Convertir el buffer a Base64 para enviarlo limpio al cliente
        const base64Pdf = Buffer.from(pdfResponse.data, 'binary').toString('base64');

        res.json({
            pdfBase64: base64Pdf
        });

    } catch (error) {
        console.error("Error downloading PDF:", error.message);
        res.status(500).json({ error: 'Error al generar la orden de pago en el portal' });
    }
});

// Serve static React files
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
