const nodemailer = require('nodemailer');

function createTransport() {
    return nodemailer.createTransport({
        host: 'localhost',
        port: 2525,
        secure: false,
        tls: {
            rejectUnauthorized: false
        }
    });
}

function sendEmail(de, para, asunto, cuerpo) {
    const transporter = createTransport();
    const mailOptions = {
        from: de,
        to: para,
        subject: asunto,
        text: cuerpo
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error al enviar email:', error);
                return reject(error);
            }
            console.log('Email enviado:', info.response);
            resolve(info);
        });
    });
}

module.exports = {
    createTransport,
    sendEmail
};
