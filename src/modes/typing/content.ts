/**
 * Textos del modo Mecanografía.
 *
 * Cada texto es un objeto con `titulo` y `contenido`; el contenido es lo
 * que la persona debe escribir. Español LATAM, con acentos y Ñ reales.
 * Todo el contenido es local: sin red, sin CDN.
 */
export interface TypingText {
  id: string;
  titulo: string;
  contenido: string;
}

export const TYPING_TEXTS: readonly TypingText[] = [
  {
    id: "kinkel",
    titulo: "El pingüino Kinkel",
    contenido:
      "Había una vez un pingüino llamado Kinkel que soñaba con escribir todas las historias del mundo.",
  },
  {
    id: "tigres",
    titulo: "Tres tristes tigres",
    contenido:
      "Tres tristes tigres tragaban trigo en un trigal mientras el sol brillaba sobre la colina.",
  },
  {
    id: "tabla-1",
    titulo: "Tabla periódica I",
    contenido:
      "Hidrógeno, helio, litio, berilio, boro, carbono, nitrógeno, oxígeno y flúor.",
  },
  {
    id: "tabla-2",
    titulo: "Tabla periódica II",
    contenido:
      "Neón, sodio, magnesio, aluminio, silicio, fósforo, azufre, cloro y argón.",
  },
  {
    id: "sistema-solar",
    titulo: "El sistema solar",
    contenido:
      "Mercurio, Venus, Tierra, Marte, Júpiter, Saturno, Urano y Neptuno giran alrededor del Sol.",
  },
  {
    id: "pablito",
    titulo: "El clavo de Pablito",
    contenido:
      "Pablito clavó un clavito, ¿qué clavito clavó Pablito?",
  },
  {
    id: "mariposa",
    titulo: "La mariposa",
    contenido:
      "La mariposa azul revolotea entre las flores del jardín mientras cae la tarde.",
  },
  {
    id: "mar",
    titulo: "El mar",
    contenido:
      "Las olas del mar golpean suavemente la arena dorada de la playa al amanecer.",
  },
  {
    id: "selva",
    titulo: "Animales de la selva",
    contenido:
      "El jaguar, el tucán, la anaconda y el perezoso viven en la selva amazónica.",
  },
  {
    id: "cuerpo",
    titulo: "El cuerpo humano",
    contenido:
      "El corazón bombea sangre a todo el cuerpo y los pulmones la llenan de oxígeno.",
  },
  {
    id: "golondrinas",
    titulo: "Golondrinas",
    contenido:
      "Volverán las oscuras golondrinas en tu balcón sus nidos a colgar.",
  },
  {
    id: "derechos",
    titulo: "Los derechos del niño",
    contenido:
      "Todos los niños tienen derecho a jugar, aprender y vivir en un mundo feliz.",
  },
  {
    id: "receta",
    titulo: "La receta",
    contenido:
      "Mezcla la harina con el azúcar, agrega los huevos y bate hasta obtener una masa suave.",
  },
  {
    id: "espacio",
    titulo: "La luz del Sol",
    contenido:
      "La luz del Sol tarda ocho minutos en llegar a la Tierra y viaja a gran velocidad.",
  },
  {
    id: "computadora",
    titulo: "La computadora",
    contenido:
      "El teclado, el ratón y la pantalla son partes de la computadora que usamos a diario.",
  },
  {
    id: "amazonas",
    titulo: "El río Amazonas",
    contenido:
      "El río Amazonas es el más caudaloso del planeta y atraviesa varios países de Sudamérica.",
  },
  {
    id: "san-roque",
    titulo: "El perro de San Roque",
    contenido:
      "El perro de San Roque no tiene rabo porque Ramón Ramírez se lo ha cortado.",
  },
  {
    id: "arcoiris",
    titulo: "El arcoíris",
    contenido:
      "Cuando la lluvia termina y sale el sol, aparece un arcoíris con siete colores en el cielo.",
  },
  {
    id: "frutas",
    titulo: "Frutas tropicales",
    contenido:
      "Mango, piña, guayaba, papaya y maracuyá son frutas tropicales llenas de vitaminas.",
  },
  {
    id: "maestro",
    titulo: "El maestro",
    contenido:
      "El maestro abrió el libro y leyó una historia que hizo volar la imaginación de sus alumnos.",
  },
];

export const TEXT_BY_ID: ReadonlyMap<string, TypingText> = new Map(
  TYPING_TEXTS.map((text) => [text.id, text]),
);
