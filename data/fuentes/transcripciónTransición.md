0:00
Entonces, acá todo se aprovecha. Bueno, entonces vamos a iniciar entonces,
0:06
compañeros. Entonces, eh como ya habíamos comentado, el día 24 es el
0:13
examen parcial 24 de 7 de la mañana a 9 de la mañana.
0:19
Realmente es mucho tiempo porque según los exámenes yo los hago normalmente
0:24
para 50 minutos, pero digamos que de 7 de la mañana en adelante, ¿eh? Y no les
0:29
digo de 7 a 9 porque si no me van a llegar algunos a las 8 de la mañana.
0:33
Entonces, no, no, de 7 a 8 para que lleguen 8 men cu porque me ha pasado, me
0:41
ha pasado que algunos han llegado 8 men 20, 8 men 4. Eh, pero bueno, ¿qué vamos
0:48
a ver hoy? Hoy vamos a ver transición de servicios,
0:52
una adicional, una parte adicional al diseño de servicios. Sí, normalmente
1:00
diseño de servicios funciona de la mano de transición. Los dos eh
1:07
vienen siendo una parte y realmente son tres departamentos, diseño, transición y
1:13
operaciones para hacer de BOBS, pero diseño y transición normalmente son los
1:18
que más eh se asemejan a departamentos y a mesas. Uno no puede trabajar sin el
1:24
otro y los dos son entrada y salida. Ahorita les voy a explicar por qué.
1:35
Para comenzar, pues transición, así como todos las áreas de ITIL, eh tiene su
1:42
fundamento en en las en las cuatro perspectivas de ITIL, las que son
1:49
organización y gente, información y tecnología, partners and supplier, o
1:53
sea, socios y y proveedores, y el valor o el flujo de valor y todos los
2:00
procesos. Entonces ese modelo, ese modelo de
2:04
cuatro dimensiones funciona de la misma manera. Así como funciona para
2:10
estrategia, como funciona para diseño, funciona también para transición. Sí,
2:19
el valor del servicio de transición tiene el el mismo comportamiento,
2:28
nace de una oportunidad que en este caso es información que tiene diseño. Sí,
2:34
diseño debe de enviar información de un sistema
2:39
a un a un ambiente para realizar pruebas. Entonces, esa es la
2:43
oportunidad. de donde nace todos los procesos de transición. Debemos avanzar
2:50
en las pruebas de un sistema para poder medianamente o o a largo plazo o corto
2:57
plazo, como sea, llevar ese sistema a un ambiente de producción. Ese sería el
3:03
ideal, ¿verdad? Sí. Okay. Eh, ustedes como lo han visto, el
3:08
diagrama de estados de ITIL comienza con el vinculamiento.
3:14
Eso se hace en estrategia, la planificación se hace en estrategia, el
3:19
diseño de la transición se hace en diseño y en transición de servicios.
3:24
Luego, el obtener y construir es una mezcla entre diseño, transición y
3:29
operaciones. Hagan de cuenta que obtener y construir
3:32
al final eh pues va a ser eh una de las actividades que vamos a tener que hacer
3:38
en DevOPS. Sí, entregar y soportar se hace en operaciones y por último mejorar
3:44
se hace en el departamento o en el área de mejora continua.
3:52
Okay, vamos. Estos son los los procesos. Vamos a iniciar. Entonces, bueno, son
3:58
los procesos de ITIL, no los de transición. ¿Cuál es el propósito de
4:03
transición? asegurar que los o el servicio nuevos o
4:09
modificados o retirados cubran las expectativas del negocio,
4:15
según lo documentado en las etapas de estrategia del servicio y de diseño del
4:21
servicio. ¿Sí? ¿Qué significa? que transición tiene que tomar
4:28
todos los documentos que Estrategia hizo, la planificación, la arquitectura,
4:35
los requerimientos, todo. Y debe, bueno, vamos a ver. Aquí dice que tiene que
4:40
haber una hoja en blanco. Está la hoja en blanco. Sí, check. Dice que tiene que
4:45
haber un formulario. Está el formulario. Sí, check.
4:48
Todo lo que se colocó en la planificación se tiene que verificar en
4:54
las pruebas finales o de integración o de estrés o unitarias, todos los tipos
4:59
de pruebas que ustedes puedan realizar. Eh, transición debe verificar que se
5:04
cumpla con todo. Si en algún momento ese servicio no cumple, obviamente
5:11
transición debe regresarlo a diseño. Sí, así de sencillo. Que lo modifiquen hasta
5:16
que cumpla. transición lo acompaña o lo lleva a operaciones. Sí.
5:25
En cuando dice que los servicios nuevos modificados o retirados es porque acá en
5:33
transición se lleva el control de la gestión de cambios.
5:38
El request for change o RFC o la gestión de cambios se hace acá en transición.
5:45
Aquí se lleva el control de Bueno, vamos a vamos a verificar eh que resulta que
5:52
ahora quieren un botón rojo en vez de verde. Entonces quiero ver que dónde
5:57
está la descripción del cambio. Aquí está. Entonces tomo la descripción y
6:01
según esa descripción verifico que cumpla con los requerimientos. Y si
6:06
cumple con los requerimientos, pues entonces lo trasladamos a operaciones
6:10
para que operaciones vuelva a verificar, lo implemente, lo de haga el deploy en
6:15
su ambiente de producción y lo y lo lance en vivo. Sí, a eso se refiere. Sí.
6:20
¿Cuál es el objetivo? planear y gestionar los cambios del servicio,
6:25
gestionar los riesgos relacionados con servicios nuevos, cambios o retirados y
6:32
desplegar con éxito, le hacen desplegar con éxito las
6:38
liberaciones en ambientes soportados. Desplegar. Sí, transición tiene el
6:45
control del despliegue. Obviamente no del despliegue en
6:50
operaciones, porque en operaciones el único que tiene control o
6:55
responsabilidad debería de ser el departamento de operaciones.
7:00
No sé si hasta el momento tengamos alguna duda.
7:09
Vale, para conocer todo el ambiente de
7:15
transición, eh, o sea, transición solo deja listo para que operaciones les dé
7:20
deploy. Eh, digamos que sí. Transición, uno de los objetivos que tiene es ir a
7:27
verificar, ir a determinar que el servicio que diseño hizo está con
7:36
respecto a los requerimientos y alcance que estrategia dictó.
7:43
transición tiene que dar su visto bueno. ¿Pasa o no pasa? Si pasa, entonces es eh
7:51
transición acompaña a operaciones para poder hacer el
7:57
deploy, pero eh en este caso es acompañamiento nada más para hacer el
8:02
deploy en el ambiente de producción. Transición no sería algo así como un
8:06
tipo de auditor, ¿eh? No, no, no, no. Ahorita van a ver los procesos y y ahí
8:12
les va a quedar un poquito más claro. No es auditor. No es auditor, sí, porque
8:16
también participa en el proceso. Eh, transición es el que lleva el control de
8:21
los cambios. Entonces, ahí está está participando también en el proceso. Sí.
8:26
Pero ahorita espérenme un ratito y ahorita ahorita van a entender. Eh,
8:32
transición tiene
8:35
algunos activos que maneja. Entre esos activos hay dos especiales.
8:42
Por ejemplo, tenemos, de hecho, yo se lo subí a su clase de hoy. Eh, en su clase
8:49
de hoy están, eh, vamos a ver, quiero ver si ahí está.
8:54
Hay un archivo, un Excel que tiene una CMDB, una base de datos de dispositivos
9:03
o configuration management. Esa CMDB es uno de los activos que
9:09
maneja transición. Sí. Eh, como les les menciono, transición
9:16
eh maneja tres diferentes eh activos o recursos para poder llevar todos sus
9:23
procesos. Los vamos a definir. Primero,
9:28
eh qué es un activo del cliente? Un activo es cualquier recurso o
9:34
capacidad que tenga alguien o alguien. El activo del cliente es cualquier
9:39
recurso o capacidad que es usado por un cliente para lograr un resultado de
9:46
negocio. Ese es el activo del cliente. Por ejemplo, el cliente el principal
9:52
activo que tiene obviamente es el dinero con el cual va a adquirir productos.
9:59
El activo del servicio es cualquier recurso o capacidad que usa
10:05
un prestador de servicios de tecnología para entregar servicios a un cliente.
10:11
Por ejemplo, en este caso nosotros podemos tener como activo podemos tener
10:17
internet, por ejemplo, conexión a internet. para nosotros puede ser un
10:21
activo y ese activo se lo vamos a trasladar al cliente para que el cliente
10:27
cotice a través de internet, haga sus negocios a través de internet, utilice
10:32
nuestro activo para obtener sus beneficios. Sí, eso se puede eso se
10:38
puede dar, se puede realizar. Eh, los recursos pues son entradas
10:46
directas a cualquier proceso productivo. Es algo que nosotros vamos a disponer
10:52
para poderlo usar eh, y que podamos transformar
10:57
nuestras actividades dependiendo lo que queramos lograr. ¿Sí? En este caso, eh,
11:03
la computadora va a ser un recurso tecnológico. Es un objeto que yo voy a
11:08
utilizar para poder conseguir mis objetivos personales, empresariales,
11:15
pero amarrado o atado a la tecnología. ¿Sí?
11:20
¿Qué son las capacidades? Las capacidades es la habilidad que una
11:23
persona puede tener. Bueno, en este caso puede ser organización, departamento,
11:27
área, persona, lo que sea. Eh, son habilidades que uno va adquiriendo o
11:34
habilidades que uno ya tiene por su propio talento para coordinar,
11:40
controlar, desplegar recursos para poder generar valor. En este caso,
11:46
yo puedo ser muy pilas para vender, pero no sé nada de tecnología. Entonces, mis
11:54
habilidades van a servir para poder realizar ventas con mayor eficacia, pero
12:00
si me ponen en un área tecnológica, pues obviamente no voy a saber qué hacer. Sí,
12:05
las habilidades normalmente van acompañadas de recursos.
12:10
una habilidad sin recursos, pues está está choca o esta coja, ¿ya? ¿Por qué?
12:17
Porque no va a tener cómo moverse. Sí. Eh, normalmente las habilidades son
12:23
acompañadas de experiencia. ¿Por qué? Porque la experiencia nos va dictando
12:28
sobre cuál es el contexto en el cual nosotros podemos extender alguna
12:33
habilidad. Sí. Okay. Los procesos de transición son
12:40
pocos, son cinco. Eh, primero que nada, tenemos una
12:46
una gestión de los activos de un servicio. Vamos a ver. Cuando ustedes
12:52
instalan CRM,
12:57
el CRM, obviamente, si lo van a hagan de cuenta que no tienen no tienen
13:02
servidores de nada. El CRM para poderlo implementar ustedes necesitan
13:07
servidores, necesitan una base de datos, necesitan un servidor que tenga un
13:13
servidor de aplicaciones, un HTTP y un servidor que tenga, no sé, concurrentes
13:19
o manejo de colas o asíncronamente van a trabajar algo. Entonces, necesitan tener
13:24
al menos dos servidores y una base de datos.
13:27
Esos son activos y esos activos, la gestión de ese activo se lleva en este
13:35
proceso que se llama gestión de la configuración y activos del servicio.
13:41
¿Por qué? Porque al final de cuentas yo voy a instalar
13:47
mi sistema en esos tres servidores, pero no quiere decir de que esos tres
13:52
servidores están solitos. Puede ser que los servidores tengan otros otros
13:58
servicios más. Entonces, vamos a agregar mi servicio o el servicio de CRM a
14:05
servidores. Eso lleva una configuración. Entonces, este proceso, ¿qué hace este
14:12
proceso? Dicta las recetas. Hagan de cuenta que es una base de datos de de
14:19
Docker Compost. Es una base de datos de recetas en donde ustedes tienen cómo se
14:24
levanta cada uno de los servicios, cómo se apaga cada uno de los servicios.
14:28
Hagan de cuenta que estos estos servidores tienen de todo ahí. Eh, hay
14:33
CRM, hay planía, hay ERP, hay eh un e-commerce, hay de todo. Y para poderlos
14:41
levantar todos, obviamente tiene que existir un script, un script en donde
14:47
ustedes le den start CRM, start
14:53
planía, start ERP, start e todos los todos los sistemas que tienen ahí esa
15:00
receta o ese script. debe de llevar un orden implícito.
15:05
Primero levantamos la base de datos, después levantamos el el de el apache o
15:10
el enginex por si tienen un reverse proxy. Después levantamos todo lleva
15:15
tiene que llevar un control y al al momento de apagar obviamente tiene que
15:20
ser al revés, también tiene que llevar un orden. Sí, este proceso, este
15:25
proceso, sí, por eso les digo, por eso les digo, este proceso gestión de la
15:30
configuración, el SAC M, hagan de cuenta que es como un proceso que que lleva un
15:37
control de Docker con Pops, de todas las recetas, de todos los sistemas que
15:42
ustedes tienen en esos tres servidores. Hagan de cuenta que así es la gestión de
15:48
cambios, pues su nombre lo indica, es un proceso que lleva el control de cambios.
15:54
¿Cómo se gestionan los cambios, cómo se autorizan? ¿Cómo se revisan? ¿Cómo se
15:58
entrega un cambio, cómo se cómo se aprueba, todo. Sí. Luego está la gestión
16:03
de liberaciones y despleges. Bueno, los cambios van a generar nuevas
16:08
funcionalidades en los sistemas. Eso se hace con la gestión de liberaciones y
16:13
despliegues. Sí. Luego está la gestión de conocimiento. ¿Qué es la gestión de
16:18
conocimiento? llevar control de cómo nosotros le vamos a trasladar la
16:23
información del sistema, de la documentación del sistema, del uso del
16:28
sistema al usuario. Una base de datos de conocimiento en donde el usuario tenga
16:33
toda la información que hay que hacer para abrir un ticket,
16:38
que hay que hacer para resolver un problema en el CRM, que hay que hacer
16:43
cuando no sé, todo tipo de problemas debe de existir en una base de datos.
16:49
y se la tienen que entregar no solo al usuario final, sino también a los de
16:54
operaciones. Transición hace eso. Eh, al de operaciones, ¿en qué sentido? El DBA
17:00
tiene que saber cómo bajar la base de datos, cómo bajar los servicios, cómo
17:05
hacer backup, cómo hacer una recuperación, una restauración, todo.
17:10
Ya. La base de datos de conocimiento es a todo nivel. Sí. Y por último está el
17:16
proceso de planeación de y soporte de la transición, que es como es el PM de
17:21
transición. Todas las áreas siempre tienen un proceso que sirve como PM,
17:27
llevar el control de los proyectos que actualmente estamos corriendo en
17:31
transición. Sí. Okay. No sé si alguien tenga alguna
17:36
pregunta. Esos cinco procesos pertenecen.
17:42
Exactamente. Así es. Esos cinco procesos forman parte. Eh, en
17:47
algunos lugares, ojo, en algunos lugares los van a encontrar como procesos o en
17:52
otros lugares los van a encontrar como prácticas. Sí, pero es lo mismo. Esos
17:56
cinco procesos forman parte de los 34. De hecho, si nos vamos de regreso,
18:05
los 34 procesos están aquí. Entonces acá ustedes deberían de encontrar
18:12
de hecho, busquemos tu derecho, aquí está este proceso que está acá se llama
18:19
configuración del servicio. Ese es el proceso SAC M. Sí,
18:25
vamos a ir a buscar dónde está. Aquí está este proceso que se llama gestión
18:31
del conocimiento. Es el proceso de creación de la base de datos de
18:35
conocimiento. E por ahí andar un uno de ¿Dónde está gestión de cambios? Aquí
18:41
está control de cambios. Este es el proceso que les mencionaba de de gestión
18:47
de cambios. Sí, son forman parte de los 34.
18:55
Okay, comencemos entonces con el SAC M. El Sáqueme. El propósito es asegurar que
19:01
todos los servicios tengan los activos que necesiten tener. Sí. O sea, yo voy a
19:09
voy a desarrollar, no, ya desarrollé, en este caso no voy a desarrollar porque ya
19:14
está desarrollado. Aquí estoy en transición. Yo voy a verificar que lo
19:18
que diseño desarrolló cuente con todos los aspectos que
19:24
necesita tener. Por ejemplo, ahí tenemos que ir a verificar que eh lo que hayamos
19:32
escrito nosotros en estrategia esté contemplado aquí. Vamos a ver en el
19:37
alcance. Dice, "Incluye la gestión del ciclo de vida completo de cada elemento
19:42
de configuración." ¿Qué es un elemento de configuración?
19:46
Un elemento de configuración es un recurso tecnológico que nosotros vamos a
19:51
usar al momento de construir un sistema. Por ejemplo, un CRM. Lo que les dije,
19:57
eh, un CRM va a guardar cotizaciones en foto o va a guardar las fotos de los
20:03
clientes. Entonces, necesitamos un S3. Un S3 para guardar todo ese tipo de
20:08
objetos. Entonces, ¿qué tiene que hacer transición? tiene que ir a verificar que
20:12
existan esos CI. ¿Cómo se llaman los CIS? Se
20:17
llaman configuration item o elemento de configuración. Debe de existir un S3. Si
20:24
no existe, entonces él tiene que levantar la bandera y decir, "Miren,
20:28
disculpen, pero esto, este CRM no pasa de etapa porque aquí falta el el
20:35
componente S3." Sí. ¿Cuáles son los objetivos? pues asegurar
20:40
que todos los activos bajo el control de la organización sean identificados,
20:47
controlados y cuidados apropiadamente a lo largo de su ciclo de vida. O sea,
20:51
servidores, S3, impresoras, todos los activos habidos y por haber deben de
20:58
existir en una base de datos. Esa base de datos se llama CMDB
21:03
Configuration Management Database. Allí deben de existir todos los dispositivos
21:08
que nosotros tengamos en una empresa, servidores, eh router, switches,
21:14
firewall, impresoras, equipo, eh, no sé, todo lo que ustedes imaginen debe de
21:20
existir ahí, incluyendo eh muchas veces discos duros son parte de los
21:27
servidores, también son configuration items. A memoria también es
21:32
configuration, por eso se convierte en una sábana pero
21:37
inmensa, porque un servidor ustedes lo destapan, le pueden sacar todos los
21:43
componentes. Entonces, todos los componentes van a ser configuration item
21:47
y un configuration item está compuesto de muchos configuration item. Obviamente
21:52
no se pueden compartir, va, un configuration item no puede estar en dos
21:56
servidores. Ahí sí triste. Ese eso sí no puede pasar. solamente puede pasar en
22:01
uno. Se deben identificar,
22:05
controlar, registrar, reportar, auditar y verificar todos los CI, o sea, todos
22:10
los configuration item. Y se deben de gestionar, o sea, llevar control en esa
22:15
base de datos. Se deben contabilizar, gestionar y proteger. ¿Por qué
22:20
contabilizar? Tenemos que ir a verificar eh cuándo fue su adquisición, cuándo fue
22:25
su fecha de adquisición, cuándo cuándo vence la garantía.
22:29
Eh, cuando lo vamos a terminar de inventariar, damos todos los aspectos
22:34
que hoy en día se verifican, eh, y debemos de asegurar la integridad de
22:39
todos los e hay algunos e que, obviamente, con la con el tiempo pues se
22:46
van degradando, entonces hay que hacer pruebas para determinar que existan o
22:50
que estén buenos todavía. Sí, todo eso, como les digo, es una base de
22:56
datos. Esa base de datos se llama cmdb, es esta que está acá. Eh, esta base de
23:03
datos puede ser un archivo de Excel. Yo les comparto un archivo Excel, pero
23:07
nosotros eh lo vamos a hacer como una base de datos. Esa va a ser la práctica
23:12
número tres que vamos a desarrollar para el tercer parcial. ¿Qué tiene que llevar
23:18
una CMDB? Debe de llevar la identificación del del configuration
23:23
item, el ID, el tipo, los atributos. Descripción, número de serie, versión,
23:30
fecha, adquisición, estado actual, las relaciones con otros e
23:35
las dependencias, un servidor, el chasí, obviamente depende de que tenga la
23:41
fuente conectada. Si no tiene la fuente conectada, pues no sirve de nada. Sí.
23:45
Entonces ese chasís va a ser dependencia para una memoria, ¿ya? ¿Por qué? Porque
23:51
esa memoria va a estar conectada en un en una ranura de de memoria, no la van a
23:57
conectar en el PCI, ¿va? ¿Sí? Entonces, eh todas esas situaciones ustedes lo
24:01
deberían de validar, ¿va? La ubicación va a estar en un centro de datos, va a
24:06
estar en un telecon room. Sí. La asignación, ¿quién va quién lo va a
24:11
tener asignado? Si lo va a tener asignado una persona o lo va a tener
24:14
asignado un área. El historial de cambios. Mira, fíjate que ese servidor
24:18
se adquirió en el 2025. ¿Y cuántas memorias se le han metido? Dos. Se
24:23
extendió a 512 GB de memoria, se extendió a otro
24:28
disco. Veamos todos los cambios que han tenido, la toda la documentación y
24:33
enlaces, la seguridad y cumplimiento, el estado de configuración. ¿Qué es lo
24:39
de seguridad en cumplimiento? Es el proceso ISO 2701 que vimos en
24:44
diseño, ¿ya? si cumple o no cumple, qué tipo de política cumple, todo eso. Eh,
24:50
las licencias, si está asociada alguna licencia, cuando vence esa licencia. Sí,
24:56
esos cambios que mencionas son tantos. Sí, sí, son hardware y software y hoy en
25:03
día se complicó más porque es hardware, software y nube. Da la causalidad que
25:08
ustedes también pueden contabilizar eh aspectos de de la nube. ¿Por qué? Como
25:15
porque como ahora ya se ya se tiene factura, pues lo pueden hacer.
25:22
adicional adicional a la CMDB, ustedes deberían de tener la gestión de
25:29
contratos, por ejemplo, ¿quién lo lo vendió? Si si
25:34
hay una garantía, si hay una renovación, deberían de tener el inventario de
25:39
hardware, lo que dije, el historial de cambios.
25:43
deberían de tener el inventario de software de la misma forma deberían de
25:49
tener los los datos de usuario. Este dato de usuario
25:55
ah es un poquito más complicado porque no necesariamente lo tenemos que
26:01
verificar de una forma intrínseca. En algunos
26:07
lugares lo que hacen es que por usuario llevan el control de la cantidad de
26:12
objetos que tienen y del tamaño, porque meterse a llevar el control de qué
26:18
información tiene cada usuario, yo lo veo, la verdad, bueno, depende de la
26:22
industria, pero en algunas industrias lo veo innecesario. ¿Qué es lo que yo he
26:27
visto? Se lleva el total, se lleva el total de objetos y se lleva el tamaño de
26:35
objetos. ¿Ya? Y mes a mes se va haciendo una una toma de eso y se lleva un
26:43
histórico por el usuario para determinar crecimientos y todo eso. Eh, sí, porque
26:48
llevar el control exacto de cada uno, pues yo lo veo un poquito complicado y
26:55
y hay en algunos lugares no tiene valor, no no va a tener valor.
27:01
No sé si hay alguna pregunta. No. Okay.
27:11
Eh, la CMDB se hace una por cada centro de datos.
27:19
Obviamente la podemos integrar. Si una empresa tiene
27:24
10 centros de datos, entonces podemos hacer una por empresa y le ponemos un
27:30
código a a los centros a los centros de datos. Sí. para poder llevar el control.
27:37
Esa base de datos que les estaba mostrando acá, esa base de datos que
27:42
está acá, esa base de datos con toda esta información que está acá,
27:47
te guarda en una base de datos que se llama CMS.
27:53
En esa base de datos, si ustedes se recuerdan, ahí se guarda los servicios
27:59
nuevos, los que se están desarrollando y los servicios que están en producción.
28:04
Ahí se guarda toda la información con lo eh con lo cual se desarrolló cada
28:10
uno de los servicios. Toda la información desde estrategia hay que
28:15
llevar control de toda la información por proceso de cada servicio. Digamos el
28:20
CRM. Bueno, el CRM pasó por un análisis financiero. Ahí hay que meter el proceso
28:27
uno, estrategia. El CRM pasó por la autorización, el CRM pasó por la
28:32
arquitectura, el CRM pasó por requerimientos, el CRM todos los
28:38
procesos hay que meter la información en esta base de datos que se llama
28:44
configuration Management System. Adentro de esa base de datos va la base de datos
28:52
CMDB. Sí, adentro del configuration management system va la x cantidad de
29:00
bases de datos que tengamos en la empresa. Sí, porque podemos tener varias
29:05
dependiendo dependiendo lo que queramos. Si queremos tener una centralizada por
29:09
empresa o queremos tener varias, una por data centro, una por teleconro, una por
29:16
la localidad de zona 1, otra por la localidad de Guatemala. Vemos, va a
29:20
depender de nosotros. Lo que sí se puede empresas en un CMS. Un CMS tiene que ser
29:29
solo para una empresa. ¿Por qué? Porque la corporación debería de tener varios
29:36
CMSs. La corporación tiene uno que se llama
29:40
SKMS, Service Knowledge Management System. Y
29:45
ese service no va a tener muchos CMS, uno por cada empresa. Y ese CMS va a
29:52
tener eh una 12, puede tener 13 MDBs, digamos, dependiendo como nosotros lo
29:57
queramos tenerlo y va a tener una base de datos CMS con muchos servicios.
30:06
¿Qué otra cosa son? Bueno, adicional
30:11
también hay otra base de datos. que se llama, bueno, esta no es base de datos,
30:16
se llama DML. ¿Qué es el DML? es la biblioteca, se
30:22
llama Data Management Library, o sea, eh biblioteca donde nosotros guardamos los
30:29
medios, todos los software con los cuales viene la instalación de un
30:35
switch, de un router, de un sistema, todo el software original que nos dan al
30:40
momento de adquirir ahí se guarda en esta DML. ¿Para qué? Si lo podemos bajar
30:47
todo ahora. Sí, pero da la casualidad que hay veces que un router eh no
30:54
perdimos los drivers. Entonces, para evitar eso, en el momento que adquirimos
30:59
ese SCI, o sea, ese servidor, ese router, ese switch, ese firewall, en ese
31:05
momento agarramos ese software y lo guardamos en esa fase de datos que se
31:11
llama DML o librería de datos de medios, dice José Milo. Entonces, una CMS puede
31:18
tener varias Sí, una CMS puede tener varias MDBs. Sí, un SKMS
31:26
puede tener varias. El SKMS lo más es lo más hasta arriba y
31:33
solo debe existir uno por cada corporación.
31:37
Ya el SKMS sí puede tener varias empresas, varios CMSs. Cada CMS puede
31:43
tener varias MDBS. Si SKMS es el más general y se llama Service Knowledge
31:51
Knowledge Management
31:55
System. Ese es la guinda, es lo más arriba, ¿ya?
32:02
Es de corporación. Una corporación tiene un SKMS
32:06
y el SKMS comienza para abajo, va a tener varias varios CMS, un CMS por cada
32:13
empresa. Sí, el CMS va a tener varias CMDBs y ahí se va para abajo. El CMS
32:19
debería de tener un CMDB, la base de datos de servicios, la base
32:24
de datos de ML, ¿sí? y debería de tener la base de datos de mejora continua, la
32:30
base de datos de transición, la base de datos de despliegues, todas las bases de
32:33
datos, un CMS para abajo. Sí. Y eso está explicado precisamente acá.
32:43
Acá está explicado. El SKMS es el más papacito,
32:49
es el más de arriba. El SKMS tiene CMS. Bueno, ustedes son de sistemas, ustedes
32:57
comprenden esto. Eh, un SKMS tiene varios CMS, un CMS tiene varios CMDB o
33:05
KDB. ¿Qué son los KDB? No, eh no error database, o sea, errores de de cómo es,
33:13
base de datos de errores conocidos. Sí, se recuerdan eh un una base de datos de
33:20
errores conocidos. Vamos a ver quién quién me puede decir
33:24
una base de datos de errores conocidos. Que no utilizan ninguna base de datos de
33:32
errores conocidos. Sí, exactamente. Gracias, José Emilio.
33:38
Los CBS es una base de datos. Eh, es solo que este no es de errores
33:42
conocidos, es de eh aspectos críticos de ciberseguridad, digámoslo así. Eh, son
33:47
de de riesgos acerca de servicios, software, puertos, eh de todo. Aquí hay
33:55
hay en los CBS hay de todo. Sí. Bueno, regresando acá,
34:00
el SKMS debería de tener todo esto. Miren, por eso les digo, el SKMS es el
34:07
papacito y solo debe existir un SKMS por cada corporación.
34:14
El CMS sí puede existir uno por cada empresa, pero el SKMS solo debería
34:19
existir uno, uno por cada corporación. Y ahí, ¿qué hay? Adentro de SKMS está el
34:25
service portfolio o portafolio de servicios. Ahí están los el servicio que
34:30
en este momento se está desarrollando, los el catálogo de servicios actuales,
34:34
lo que ustedes ya hicieron, los servicios retirados, eh aquí están las
34:39
bibliotecas de datos o de medios, eh losdbs, cada uno por cada data centro,
34:47
incidentes, eh servicios, requerimientos de servicios, problemas, errores
34:52
conocidos, gestión de cambios, releases, todo esto que está acá. Cada uno de
34:58
estos es una base de datos y todo eso debería estar primero en el CMS y
35:05
después en el C en el SKMS. Ya, si se dan cuenta, todo esto apunta al CMS.
35:13
Primero, el portafolio también está dentro del CMS y
35:19
por fuera lo único que apunta es el SKMS. Vamos, guíense por esto y van a
35:26
entender perfectamente. Sí, no sé si estamos claros hasta el momento.
35:35
Sí. Okay. Luego viene el proceso gestión de cambios. Este proceso, su propósito
35:43
pues es controlar el ciclo de vida de todos los cambios. ¿Y cómo se controlan?
35:48
con el sistema de tickets. El sistema de tickets, adicional a los incidentes, a
35:54
los problemas, a los eventos, también hay un ticket que se llama gestión de
35:59
cambios. Un ticket de cambio, mira, necesito que me agreguen un reporte.
36:04
Créate un ticket de cambio del sistema. Perfecto. Entonces, este proceso es el
36:09
que gobierna esos cambios. Ya.
36:14
Eh, describí qué querés, a quién se lo vamos a asignar, qué sistema es, todo,
36:20
todo, todo debería llevar acá. Esas bases de datos, esas bases, bases de
36:25
datos pueden ser lo que ustedes quieran. Puede ser una base de datos relacional,
36:29
puede ser una carpeta, puede ser una base de datos de grafos, pueden ser lo
36:34
que ustedes se imaginan, ¿ya? cualquier cosa, cualquier cosa.
36:41
Y va a haber todo tipo de información, todo tipo de información. Ahí va a haber
36:46
mapas. Eh, he visto en algunos lugares eh
36:52
reuniones grabadas. He visto reuniones grabadas, he visto
36:56
audios, he visto tableros de miro, he visto PDFs, he visto Words, documentos,
37:05
Mardown. repositorios, he visto de todo. Entonces, normalmente,
37:12
normalmente cuando decimos base de datos, automáticamente ustedes lo pegan
37:16
a a su curso de bases y lo amarran a una base de datos
37:22
relacional o no relacional, pero realmente una carpeta, una carpeta
37:27
es base de datos, ¿ya? Una carpeta es base de datos. Lo único que no está
37:31
amarrado a un a un ¿qué? a un árbol B, que es lo que le da su forma de
37:37
almacenamiento a una base de datos relacional.
37:40
Pero una base de datos puede ser perfectamente una carpeta,
37:45
que la recuperación va a ser horrible. Sí, la almacenamiento, pues también sí
37:51
va a ser horrible, pero es una base de datos. Sí.
37:58
Okay. Eh, la gestión de cambios tienen varios
38:03
tipos de cambio. Por ejemplo, los más normales,
38:08
los sistemas más normales manejan tres tipos de cambios. El cambio normal, que
38:13
es cualquier cambio que tengamos tiempo para planear, presupuestar, para
38:20
definir, eh para tomarnos el cafecito, para validar si funciona o no.
38:26
tenemos 3 meses para hacerlo. Perfecto. Ese es un cambio normal. Sigue un un
38:32
flujo de cambio donde hay una autorización, donde se hay una
38:38
asignación, donde esperamos que eh que un desarrollador salga de regrese de
38:44
vacaciones para tomar ese cambio. Sí, hay tiempo. Eh, dice una pregunta,
38:49
"Ingeniero, ¿y qué diferencia hay entre esas bases de datos?"
38:53
Eh, mira, ese es ese es clase para otro es
38:59
clase para otro curso vos, pero bueno, eh, depende depende el tipo de
39:04
almacenamiento, el tipo de gestión, recuperación, eh
39:09
depende. Por ejemplo, una SQL es la base de datos que que sigue el estándar de
39:16
COD. Espero la verdad, si no me voy a enojar de que
39:21
ustedes sepan quién demonios es C. Dígame quién es C.
39:30
No me dice que no saben quién es COD. Ah, sí, más o menos. La COD estableció
39:42
cinco reglas, eh, cinco reglas de COD. Eh, esas reglas son las que dictan las
39:48
reglas normales que menciona José Emilio. Eh, sí, así es. Pero esa esas
39:53
reglas solo dictan las bases de datos SQL. Eh, las no SQL nada que ver. Sí.
40:01
Entonces, ¿cuál es la diferencia? La diferencia es la forma en que se
40:04
gestionan. Eh, las SQL se gestionan a través de algoritmos de e de árboles.
40:12
Por ejemplo, Oracle es un árbol vitri. un vitri
40:17
asterisco. Eh, hay algunas otras bases de datos. Por ejemplo, CLite es un árbol
40:23
ABL balanceado. Eh, por eso es que algunas tienen más
40:28
ventajas que otras. Eh, es en todas las bases de datos no SQL son diferentes.
40:35
Hay unas por documento, hay otras por clave valor, digamos, dependiendo cómo
40:41
se gestiona. Hay otras que son grafos. ya que son eh siguiendo nodos y enlaces.
40:49
Hay otras que son columnares, o sea, son de columnas. Va a depender cómo se
40:54
gestiona. Así es. Son las bases de datos. La diferencia entre las bases de
40:58
datos. Igual hay unas que son carpeta. Las carpetas son las que se consideran
41:05
como eh se consideran como, quiero verlo,
41:15
esas son data. ¿Por qué? Vamos a ver. Data warehouse
41:21
es base de datos estructurada. Esa puede ser
41:26
vi y todo. Lake o data lake es una base de datos no
41:32
estructurada. En ese caso ahí podemos meter nosotros cualquier cosa,
41:36
fotografía, bitácora, eh audio, video, eh una base de datos, todo. Sí. Layhouse
41:47
es unión de data warehouse yata lake. Un data lake acepta data warehouse como
41:56
un objeto más. Sí. Eh, por eso ahí me estás me están mezclando algunas cosas.
42:02
Hoy en día hay hasta un swam, un lake swam donde mezclamos de todo. Sí. Esto
42:10
al final de cuentas se mira en eh la maestría. Esto se ve en la parte de
42:16
maestría. De hecho, yo doy esos dos cursos, introducción, análisis de datos
42:21
y análisis de datos avanzado. Eh, se da en la maestría de mining, en la maestría
42:27
de ciencias de la computación y se da toda esta parte. Sí. Eh, vamos a
42:34
avanzar. Estábamos acá con el cambio normal. El cambio normal es el que
42:38
tenemos tiempo para poder analizar todo lo que tengamos que analizar con el
42:43
cambio normal. Existe un comité que autoriza cambios.
42:48
Sí, esto puede pasar con estos con los cambios normales,
42:54
pero no pasa con los otros dos tipos de cambio. ¿Por qué? Porque el cambio de
42:59
emergencia, como su nombre lo indica, son cambios que deben de ser
43:04
implementados ya. ¿Y cuáles son esos cambios? todos los que afectan
43:09
integridad y seguridad del servicio. Esos son los cambios de emergencia y por
43:15
lo regular estos cambios son preautorizados. O sea, es un cambio de
43:20
seguridad. Sí, eh lo alguien lo autoriza y vámonos. Hay
43:25
que gastar algo. Sí, cómprelo. ¿Por qué? Porque estamos hablando de aspecto de
43:29
seguridad o que el servicio se va a caer. Y los otros son cambios estándar.
43:35
Los cambios estándar dice que son cambios preautorizados de bajo riesgo y
43:41
que siguen un procedimiento. Por ejemplo, nos estamos quedando sin
43:45
espacio en la base de datos, ya estamos al 90%.
43:49
Entonces, ya hay un proceso que alguien dejó en la base de datos SKMS, ya en la
43:56
base de datos de gestión de conocimiento hay un proceso donde indica cómo
44:01
agrandar una base de datos. Eso ya lo puede hacer cualquier persona,
44:06
bueno, que tenga permisos. Entonces, agarramos ese cambio, lo asignamos y esa
44:10
persona tiene que eh gestionar cuándo lo va a hacer. Sí.
44:18
Okay. El cambios, como les decía, e genera un comité de cambios. ¿Quién es
44:24
el comité de cambios? es un ente que está normalmente eh formado por tres o
44:32
cinco personas que por lo regular son los gerentes más importantes de las
44:37
áreas, el gerente de TI, el gerente de ventas, el gerente de mercadeo, el
44:40
gerente de finanzas y el gerente de logística. Y entre ellos se asignan la
44:47
prioridad de los cambios. Esos cambios donde hay tiempo, no son los de
44:52
emergencia ni los preautorizados, son los cambios donde mirá, necesito dos
44:57
reportes para mercadeo, necesito cuatro reportes para no sé qué. Entonces ahí lo
45:02
que hacen es, bueno, hay servicio disponible. Sí, mira, aquí está este
45:05
recurso para utilizarlo. Entonces se realiza, se hace y y sigue un proceso.
45:12
Sí, se asigna. Y ese ese al que se le asigna se genera tiene que generar una
45:16
planificación, eh un rollback por si por si no salió bien el cambio, el deploy
45:23
del cambio. Entonces debe generar un escenario de rollback eh para poder
45:28
generar el display del cambio. Sí. Luego luego viene la gestión de las
45:37
liberaciones. ¿Qué es una liberación?
45:41
es cuando nosotros lanzamos un producto, una funcionalidad o un cambio. Sí, se el
45:48
proceso se llama gestión de liberaciones y despliegues. Sí, pero realmente es
45:55
incluye todo. Hay liberaciones mayores, liberaciones
46:00
menores y liberaciones de emergencia. Su nombre lo indica. Las liberaciones de
46:05
emergencias son cuando involucran algún cambio de seguridad o de emergencia. Las
46:12
liberaciones menores son para modificar algún aspecto de disponibilidad, de
46:18
capacidad o o de lo que fuera. Y las liberaciones mayores es cuando agregamos
46:23
una nueva funcionalidad. Dependiendo la empresa, existe un flujo,
46:30
existe un flujo que sigue el proceso de deliberaciones y despliegues.
46:35
Cada empresa genera uno. Puede ser que sea de BOBS, puede ser que no, puede ser
46:41
que pasemos por desarrollo, eh QA, preproducción y producción. Puede ser.
46:49
digamos, ahí cada empresa eh planea y desarrolla las liberaciones como mejor
46:54
le convenga. Sí. Eh, en este sentido, obviamente ustedes
46:59
ya son expertos en CCD. ¿Por qué? Porque eso es lo que han visto con Kevin, eso
47:05
es lo que han visto con el auxiliar. Sí. en donde tenemos pues el circuito de
47:09
devobs y Til no está peleado con este circuito.
47:14
Si se dan cuenta, diseño, transición y operaciones pueden en alguna manera
47:21
navegar por este circuito. Sí. Eh, los tres departamentos pueden navegar por el
47:27
circuito de DevOPS, solo quedaría por fuera estrategia y del otro lado mejora
47:33
continua. Sí, quedaría aquí estrategia y mejora continua y en medio estaría pues
47:39
el así el circuito de Bobs, ya
47:49
que de hecho esa es la versión 5 de ITIL, la versión 3, la 3.1, un la que
47:56
salió en el 2012 es la versión más estándar posible. La versión 4 que salió
48:03
en el 2020 cabal para pandemia se le agregó todo el tema de nube. Sí, la
48:09
versión 5co se agregó se agregó todo el tema de devobs. Sí.
48:17
Okay. Luego vienen el proceso de la gestión
48:22
del conocimiento, pero para entrar al proceso de gestión del conocimiento
48:26
tenemos que entender de dónde viene el conocimiento. Y el conocimiento viene
48:31
precisamente de la transformación de la data en información, en
48:37
conocimiento y en sabiduría. La data más contexto genera información,
48:42
la información más sentido genera sabiduría.
48:46
Eh, no, conocimiento y el conocimiento más el hallazgo genera sabiduría.
48:51
Esto, esta, ese triangulito tiene un nombre y ese
48:58
triángulo se le asume a un filósofo de 1890 que se llama Gabriel Tardo. Este
49:04
filósofo estableció una política, ¿no? Una teoría, la teoría de la difusión de
49:11
las innovaciones, que permite precisamente construir
49:17
conocimiento a partir de datos. Sí. ¿Qué hace el proceso de gestión del
49:24
conocimiento? Construir
49:28
una base de datos de conocimiento que sirva a toda la empresa. Pero a toda la
49:33
empresa me refiero a proveedores, a usuarios, a clientes, a técnicos, al
49:40
DBA, a todos. En esta base de datos de conocimiento debería existir la
49:45
información de todos. Sí. El propósito dice compartir
49:50
perspectivas, ideas, experiencia e información de todos los servicios. Sí,
49:59
en esta base datos de conocimiento, como les dije, usa el proceso de IKW.
50:05
Esto que está acá es el proceso DIKW formado por las siglas data information
50:13
knowledge Wisdom. Sí, esta base de datos de conocimiento
50:20
debería de estar dentro del SKMS también. Sí. Y debería de existir una
50:27
base de datos de conocimiento por cada CMS, o sea, debería de estar una base de
50:33
datos por cada empresa. Y por último, tenemos el proceso de
50:41
planeación y soporte de la transición que es un PM. es llevar el control, es
50:45
un Excel o una base de datos, como ustedes quieran desarrollarlo, llevar el
50:49
control de los proyectos que en este momento estamos teniendo en transición.
50:53
El jefe de transición tiene su Excelito en donde tiene todo el listado de
50:58
proyectos que en este momento está haciendo, qué recursos está asignando,
51:02
quién lo está haciendo, cuánto está gastando, cuándo comenzó, cuándo va a
51:06
terminar, etcétera, etcétera, etcétera. Todo lo que lo que va a presupuestar,
51:12
¿sí? Y ahí acabaría la parte de transición.
51:18
¿Tienen alguna pregunta con respecto a transición?
51:29
No me asustan ustedes, hombre. Me asustan que no tengan no tengan
51:37
preguntas con que no me vayan a estar haciendo
51:41
preguntas al 24. Sí, José se escucha.
51:48
Sí, sí, sí. Okay. Yo tenía una duda, eh, como es
51:52
cierto, se había mencionado que en la parte de transición se mostraba cómo eh
51:58
diagramar esta parte, esto, esto, ¿cómo se diagrama? Es que la vez
52:03
pasada le pregunté en qué parte de esto se plasma en un diagrama y ha dicho que
52:08
en la parte tenía que esperar hasta la parte de transición.
52:11
a esta parte, a esta parte de aquí. Espérame, pues, ahorita te lo muestro.
52:18
Vos me preguntaste todos los procesos de estrategia y de diseño, cómo se
52:23
diagramaban o en qué momento se veía la unificación de la información que
52:29
estaban generando. Eso fue lo que me preguntaste
52:33
la clase pasada, ¿cómo se lleva la estrategia después que eso pasaba al
52:36
diseño para hacer el como prototipo y después ya lo llevaba a la transición?
52:41
Pero no sabía cómo seía eh
52:43
precisamente así. Mira, pues estrategia al final de cuentas es el que recibe los
52:50
servicios. Estos servicios son servicios a proponer, son servicios para el otro
52:56
año. Ahorita estamos en octubre. Perfecto. Entonces, cinco usuarios se me
53:00
acercan y me dicen, "Mira, yo quiero el servicio A, el servicio B, el servicio
53:03
cinco servicios. Esos cinco servicios yo estrategia los meto en mi archivito,
53:10
los documento, les pregunto por los requerimientos,
53:15
documento los requerimientos y esos requerimientos son los que me van a
53:19
servir a mí para poder hacer el análisis financiero. ¿Sí? Va. ¿Dónde documento
53:26
los requerimientos? Todos los requerimientos van a estar documentados.
53:31
¿En dónde estoy buscando? Tu tu tu
53:41
encuentro, pero siguiendo este orden. Bueno, vamos
53:47
a suponer que están acá. Estrategia es el primero que comienza con el tema de
53:53
estrategia de servicio. En estrategia de servicio debería estar los
53:59
requerimientos del usuario, cuánto el análisis financiero, que es la parte de
54:04
el retorno de inversión, si existe caso de negocio, te das cuenta, van en orden.
54:11
Luego está la data de la demanda, de la gestión de la demanda. ¿Qué fue lo que
54:17
yo vi afuera? Mira, fíjate que afuera este servicio que quieren es un CRM y
54:23
resulta que por qué lo vamos a desarrollar si allí afuera venden uno
54:27
que es igual y que me cobran una mensualidad de no sé ,000 y contratar a
54:33
un a un pato a una serie de patoj me va a salir en 15,000 quetzales al mes.
54:40
Entonces, mejor comprémoslo, digamos, no lo desarrollemos. Ese
54:45
ese caso si sigue así. Si te das cuenta, aquí es donde comienza el orden,
54:52
después se va al caso de negocio. Ese caso de negocio debería de generar la
54:57
arquitectura, que en este caso se llama service models.
55:02
Ya, aquí te genera la arquitectura. En el inter aquí hay planeación. ¿Qué es
55:09
esa planeación? esta arquitectura que está acá, esta arquitectura se
55:15
desarrolló dependiendo de estos documentos que están acá. Se hace una
55:19
reunión con el usuario. Estos documentos el usuario dice, "Ah, sí me gusta usted.
55:24
Perfecto. Entonces, si le gustó, lo vamos a meter en la planificación.
55:30
Se hace la planeación, ¿va? Entonces, se mete en la planeación en el mes de
55:35
noviembre. Yo estrategia tengo que ir a la gerencia a pelear por esos servicios
55:42
que quieren implementar. ¿Para qué? Para que me den presupuesto para el próximo
55:47
año para poderlo hacer. No es que yo lo yo hice los documentos, ahorita se los
55:52
di a diseño y diseño automáticamente se sientan y comienzan a desarrollar. No,
55:58
se sigue un proceso. Sí. Va, luego ese plan pasa por la configuración que
56:05
necesita cada servicio. Cada servicio necesita otra vez una configuración.
56:12
Necesitamos tantos servidores. Bueno, tenemos capacidad para hacer eso. No,
56:17
hay que adquirir. Entonces, súmenlo al gasto, súmenlo a lo que al presupuesto.
56:23
Va, siguiendo. Bueno, ya lo autorizó la gerencia. Sí, va. Órale, ya está
56:28
autorizado por gerencia y por usuario. Entonces, venimos y nos vamos aquí. ¿Se
56:34
acuerdan el SDP, el service design Package, el paquete de diseño, aquí
56:40
está? Bueno, entonces ya diseño recibe el SDP, se lo asignan a un equipo de
56:48
desarrollo y bueno, comienzan a desarrollar patojos y ahí va los patojos
56:53
desarrollan, finalizan. Perfecto. Entonces, ¿qué hacen ahora? Hay que
56:57
desarrollar igual el SLA, el OLA, eh el UC. El ¿Qué es el UC? O sea, SLA es
57:05
acuerdo de nivel de servicio con el proveedor, el OLA acuerdo de nivel de
57:11
servicio internamente y el UC es acuerdo de nivel de servicio contractuales,
57:18
ya sea con un partner o un proveedor. Esto quiere decir underpinning contract
57:26
o contratos de bueno, underpinning es trabajos a destajo, digámoslo así,
57:33
outsourcing. Entonces todo este esquema al final de cuentas
57:38
ustedes lo van diagramando. Si te das cuenta, aquí aunque no lleva el estricto
57:44
orden, el estricto orden, más o menos si sigue una,
57:50
¿qué? una correlación aquí con todas las actividades que hay que ir haciendo. Ya
57:56
después realizamos esta parte de la de la transición,
58:02
realizamos el de liberación, el release plan o plan de liberación, el plan de
58:08
despliegue, el las pruebas, eh la documentación técnica, qué
58:14
transición la tiene que entregar, los planes de de mejora, eh los
58:19
procedimientos estándares y acá ya entonces aquí sí ya entra todo el tema
58:24
de operaciones. Esto es el tema de operaciones, el manejo de eventos, el
58:28
manejo de problemas, el manejo de incidentes, el manejo de cambios y el
58:31
manejo de servicios o requerimientos de servicio. Después de eso ya entra el
58:37
tema de eh continual service improvement, que es la base de datos que
58:42
maneja todos las posibilidades de mejora que existen de los servicios. Y por
58:47
último, pues la reportería de los servicios, toda la información de cada
58:52
uno de los procesos de los de las 34 procesos que existen. Sí. Si querés
58:58
seguir el flujo completo, tenés que ir a agarrar la diapositiva número dos o
59:06
número tres que puse acá. Vamos a regresar,
59:13
¿no? La tres. Está si querés llevar el control, el
59:21
diagrama específico, todos los procesos, deberías de Bueno, es que aquí no tiene
59:26
el número. Vos, vos querés un número. Deberíamos Voy a tratar de conseguirte
59:31
un número para Vamos a ver, ahorita quiero ver. Es que existe, pero para la
59:37
versión 3.1. Eh, en este caso sería,
59:47
vamos a ver si encuentro una y que sea fácil de
59:55
que sea fácil de validar, si no para la otra semana se las
1:00:02
prometo. Mm.
1:00:11
Quiero ver esta. No, esta no se los va a prometer para la
1:00:21
próx el próximo viernes para que la ustedes la vean así como me imagino que
1:00:26
vos la querés, que sería como Bueno, este es el número
1:00:31
uno, ahorita viene el dos, ahorita viene el tres.
1:00:37
Vamos a ver. Sí, sí, más o menos te respondí tu
1:00:42
pregunta. Sí, sí. Ya, ya en caminó. Ya ya tengo
1:00:45
una idea. Okay. Okay. ¿Alguien, algún otro,
1:00:52
alguien más? Va, ahí se acuerdan. Examen parcial va a
1:00:59
ser el 24. 35 personas, ahí se acuerdan. 24.
1:01:06
7 de la mañana. Pueden llegar a las 6:15 más o menos. Por esa hora estoy yo ahí
1:01:11
en la en el salón. El salón es el 112. Sí, pueden llegar. ¿Cuál va a ser? Eh,
1:01:20
va a ser presencial, eh, va a ser de ir a eh validar algunos casos de uso y
1:01:27
sobre los casos de uso, pues van a tener que aplicar todo este conocimiento que
1:01:31
hemos visto al día de hoy. ¿Qué nos hace falta? Nos hace falta el viernes ver el
1:01:36
tema de operaciones, o sea, vamos a ver todavía eventos, tickets, todo lo que va
1:01:42
en operaciones. Luego el día miércoles vamos a ver el tema de eh mejora
1:01:46
continua y el viernes, el último viernes, vamos a ver el tema de sistema
1:01:52
de tickets, ¿sí? Que es con lo cual cerramos y el sábado pues es el parcial.
1:01:58
Sí, cuando dice casos de uso, pocas palabras, preguntas. Sí, así es.
1:02:04
Esperen sorpresas, hombre. Ustedes también quieren que les detalle todo,
1:02:09
hombre. Si no, ¿qué sorpresa va a haber? Se van a aburrir rápido, hombre. No,
1:02:14
hombre, esperen sorpresas, ¿no? Sí, es eh va van a ver, yo les voy a a colocar
1:02:20
en el examen algunos casos de uso y sobre los casos de uso ustedes van a
1:02:25
tener que contestar eh un examen de opciones de opción múltiple en donde van
1:02:31
a tener que aplicar obviamente pues su talento. Eso, eso es lo bonito de los
1:02:36
exámenes presenciales, que ahí eh ahí no hay no hay que se pueda que se pueda
1:02:43
utilizar, va, porque de aquí a que se usa y por eso cada vez que una persona
1:02:49
tarda más de 30 minutos en uno de estos tipos de exámenes, eh levanta una gran
1:02:54
bandera, porque no no debería de tardarse eh más de 30 minutos. Son por
1:03:01
lo regular son 20 25 preguntas, entonces 25 minutos
1:03:06
porque es de aplicación de conocimiento. Ni siquiera tienen que escribir eh en
1:03:11
estos tipos de exámenes ni siquiera tienen que escribir, solamente tienen
1:03:14
que captar la el caso y tienen que verificar y y decidir cuál sería la
1:03:22
mejor gestión dependiendo de la pregunta y dependiendo de las respuestas. Créame,
1:03:28
eso no les toma pero ni un minuto, ni un minuto. Entonces, muchas veces si se
1:03:33
tardan más de 25 o 30 minutos, obviamente es así es levantando una
1:03:38
bandera, va, o que no tienen ni el conocimiento para poder hacer ese
1:03:43
examen o que están esperando si alguien alguien les dice algo, va, que por
1:03:48
cierto tengan cuidado porque por lo regular en esos exámenes yo hago al
1:03:53
menos cinco cinco tipos diferentes. Entonces, ya me ha pasado, ya me ha
1:03:59
pasado que es más, un compañero hace como tres semestres, si no estoy mal, me
1:04:06
preguntó que por qué el compañero había sacado más puntos y no se había dado
1:04:11
cuenta de que tenía un examen diferente. Vamos a ver qué dice cuando Ajá. Yo me
1:04:17
tardo más leyendo y analizando la pregunta.
1:04:21
Bueno, está bien, les doy eso. Tienen razón, eh. indeciso, hombre. No hay que
1:04:28
ser indeciso, hombre. La vida, la vida necesita acción. Eh, tan envidioso de
1:04:33
compañeros que andaba contar. Sí, hombre. No, hay que tener hay que
1:04:39
tener acción. Eh, miren, una de las una de las cosas que en algún lugar me
1:04:46
recuerdo yo que me contaron fue si una persona eh lee
1:04:52
tres veces el mismo párrafo, la tercera vez que leyó el párrafo, ya se lo
1:04:59
aprende de memoria. Así, así el es el el cerebro de de pilas. Eh,
1:05:06
desgraciadamente muchas veces al no tener el mapa completo de información
1:05:12
para poder resolver eh ese párrafo de de conocimiento que existe, es donde entra
1:05:20
lo que lo que Giovanni dice, la indecisión. Eh, algunos algunos pues no
1:05:28
son indecisos, contestan como venga. Muchas veces les funciona, otras veces
1:05:35
no. Sí, hay hay de todo. Hay de todo, hay de todo en la vida. Pero bueno, eh,
1:05:42
bueno, entonces si ya no hay más preguntas, compañeros,
1:05:46
nos quedamos hasta acá y vamos a a realizar nuestra nuestra clase de
1:05:52
operaciones el día viernes. El día viernes, para los que no fueron a
1:05:56
COESIS, eh, sí va a haber examen corto. Para los que fueron a Coesis, no se
1:06:03
vayan a meter al examen corto. ¿Por qué? Porque no les voy a regalar más puntos.
1:06:08
Amos, hasta ahí nada más. Sí, sí, porque sí hay algunos que no fueron y nos dará
1:06:14
igual una semana para lo de agregar. Hay una semana, sí. Eh, la parte de
1:06:19
catálogo, ¿sí? No, nada que una semana. El viernes, el viernes les dejo la la
1:06:24
otra práctica que tienen que agregar la parte de CMDB. Ya ahorita tienen su
1:06:30
servicio, su catálogo de servicios, ya está agregado. Ahora van a tener que
1:06:35
construir estrategias con esos servicios.
1:06:40
Y entre la construcción, eso está para el tercer parcial, entre la construcción
1:06:45
está, ahorita tienen que construir la CMDB, que es el archivo que le subí hoy
1:06:52
a su clase. Ese archivo lo tienen que transformar.
1:06:58
Con esa transformación, para el examen final, ustedes van a tener que construir
1:07:04
eh políticas de alta disponibilidad, de
1:07:10
standby, de gestión continua, de integración continua, de desplegue
1:07:15
continuo, todas las políticas que vamos a ver en las últimas dos clases que van
1:07:20
a servir para el examen final, no para el examen parcial. Eso no lo vamos a ver
1:07:26
para el examen parcial. Lo vamos a ver para el examen final. Sí. Eh, entonces,
1:07:31
créanme, ahorita el primer parcial y el segundo que bueno, les fue bien. Los
1:07:36
felicito. Eh, prepárense porque viene lo más bonito, viene lo más lo más sabroso.
1:07:42
No, créanme, esto es, la verdad es bonito porque tiene muchas áreas donde
1:07:47
ustedes pueden implementar. Eh, por ejemplo, un sistema de tickets,
1:07:52
todas las empresas, la mayoría de empresas eh tienen un sistema de tickets
1:07:56
que muchas veces no les funciona. Sí. ¿Y qué porcentaje valdrá esa práctica en el
1:08:03
segundo parcial? Eh, como solamente dos actividades se hicieron, van a quedar en
1:08:08
5050. Eh, para el tercer parcial, para el
1:08:13
tercer parcial, si no va a ser 50 50. Eh, lo voy a definir. Creo que lo había
1:08:18
definido en 25, 50 y 25, creo. Me recuerdo yo. 25 la práctica, eh, 50 el
1:08:27
examen y 25 Ah, no, pero era porque habíamos hecho, no lo voy a definir bien
1:08:34
y les cuento el viernes. A mí me hizo falta el corto cinco como
1:08:42
se haría con la de la asistencia a la solo que te esperes para el próximo
1:08:46
semestre y el otro semestre sí eh yo me responsabilizo que te lo pongo. Fíjate,
1:08:52
no ahorita triste tu caso, Álvaro. Ya, ya.
1:08:57
Imagínate como ahorita la gran ya está muy difícil, vos está muy difícil que es
1:09:03
que si sabes lo que pasa que si no tendría que darle la oportunidad a los
1:09:06
demás y imagínate regresar regresar a ver todos los cortos. No, hombre, está
1:09:13
complicado está complicado.
1:09:19
Sí, triste tu caso, Álvaro. Sí, está muy difícil, es que ahí sí está
1:09:28
complicado porque tendría que darle la oportunidad a todo el mundo, pues.
1:09:32
Entonces tendría solo, imagínate tendría que mandarle un correo electrónico a
1:09:35
todos los que a todos los que ya no vinieron,
1:09:39
porque hasta ellos habría que incluirlos, va. Si les voy a dar
1:09:43
oportunidad para atrás, si den una oportunidad los que sí,
1:09:51
pues fíjate que los que vinieron, a los que están viniendo en clase, pues les
1:09:55
doy la oportunidad de aprender. Es buena oportunidad.
1:10:00
Es buena oportunidad, hombre. Eh, sí, sí, les voy a dar les voy a dar algo.
1:10:04
Miren, sigan viniendo y el último día o un día anterior pues puede ser que les
1:10:08
dé una sorpresa. Por eso sigan viniendo. Tampoco les voy
1:10:12
a decir, va, ya ustedes ya me están viendo cara de Santa Claus, hombre. Eso
1:10:17
sí me asusta. No estoy tan gordo. No, hombre,
1:10:27
soy un simple mortal. Sí, va. Bueno, compañeros. Okay,
1:10:35
entonces nos quedamos hasta acá. Nos vemos el próximo viernes, entonces antes
1:10:40
del Ah, sí, mínimo. No, los tengo que ver en el examen, en el examen privado.
1:10:45
Ahí no se salvan, no se preocupen, ahí no se salvan.
1:10:51
Ve, compañeros, nos vemos el el viernes. Pasen feliz noche.
1:11:00
Feliz noche a todos.