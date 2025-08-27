--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: applicant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.applicant (
    applicantid integer NOT NULL,
    firstname text NOT NULL,
    middlename text,
    lastname text NOT NULL,
    departmentid integer,
    positionid integer,
    contact character varying(20),
    address text,
    email character varying(255),
    gender text NOT NULL,
    age integer NOT NULL,
    birthdate date,
    sss_number character varying(20),
    pagibig_number character varying(20),
    philhealth_number character varying(20),
    bir_number character varying(20),
    status text,
    applicationdate date NOT NULL,
    trainingdate date,
    applicantimage bytea,
    resume JSONB
);


ALTER TABLE public.applicant OWNER TO postgres;

--
-- Name: applicant_applicantid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.applicant_applicantid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.applicant_applicantid_seq OWNER TO postgres;

--
-- Name: applicant_applicantid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.applicant_applicantid_seq OWNED BY public.applicant.applicantid;


--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    attendanceid integer NOT NULL,
    date date NOT NULL,
    employeeid integer NOT NULL,
    timein time without time zone,
    timeout time without time zone
);


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: attendance_attendanceid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_attendanceid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_attendanceid_seq OWNER TO postgres;

--
-- Name: attendance_attendanceid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_attendanceid_seq OWNED BY public.attendance.attendanceid;


--
-- Name: department; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.department (
    departmentid integer NOT NULL,
    departmentname text NOT NULL
);


ALTER TABLE public.department OWNER TO postgres;

--
-- Name: department_departmentid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.department_departmentid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.department_departmentid_seq OWNER TO postgres;

--
-- Name: department_departmentid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.department_departmentid_seq OWNED BY public.department.departmentid;


--
-- Name: document; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document (
    documentid integer NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    uploaddate date NOT NULL,
    employeeid integer
);


ALTER TABLE public.document OWNER TO postgres;

--
-- Name: document_documentid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_documentid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_documentid_seq OWNER TO postgres;

--
-- Name: document_documentid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_documentid_seq OWNED BY public.document.documentid;


--
-- Name: employee; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee (
    employeeid integer NOT NULL,
    firstname text NOT NULL,
    middlename text,
    lastname text NOT NULL,
    contact character varying(20),
    address text,
    email character varying(255),
    hiredate date NOT NULL,
    sss_number character varying(20),
    pagibig_number character varying(20),
    philhealth_number character varying(20),
    bir_number character varying(20),
    leavecredit numeric(5,2) DEFAULT 0.00,
    departmentid integer,
    positionid integer,
    shiftid integer,
    applicantid integer,
    type text,
    employeeimage bytea
);


ALTER TABLE public.employee OWNER TO postgres;

--
-- Name: employee_employeeid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employee_employeeid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.employee_employeeid_seq OWNER TO postgres;

--
-- Name: employee_employeeid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employee_employeeid_seq OWNED BY public.employee.employeeid;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory (
    itemid integer NOT NULL,
    itemname text NOT NULL,
    quantity integer NOT NULL,
    lastmodified date NOT NULL
);


ALTER TABLE public.inventory OWNER TO postgres;

--
-- Name: inventory_itemid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventory_itemid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventory_itemid_seq OWNER TO postgres;

--
-- Name: inventory_itemid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventory_itemid_seq OWNED BY public.inventory.itemid;


--
-- Name: inventorylogs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventorylogs (
    logid integer NOT NULL,
    itemid integer NOT NULL,
    employeeid integer NOT NULL,
    quantity integer NOT NULL,
    date date NOT NULL
);


ALTER TABLE public.inventorylogs OWNER TO postgres;

--
-- Name: inventorylogs_logid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventorylogs_logid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventorylogs_logid_seq OWNER TO postgres;

--
-- Name: inventorylogs_logid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventorylogs_logid_seq OWNED BY public.inventorylogs.logid;


--
-- Name: leave; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave (
    leaveid integer NOT NULL,
    date date NOT NULL,
    employeeid integer NOT NULL,
    reason TEXT
);


ALTER TABLE public.leave OWNER TO postgres;

--
-- Name: leave_leaveid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_leaveid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_leaveid_seq OWNER TO postgres;

--
-- Name: leave_leaveid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_leaveid_seq OWNED BY public.leave.leaveid;


--
-- Name: position; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."position" (
    positionid integer NOT NULL,
    positionname text NOT NULL,
    departmentid integer NOT NULL
);


ALTER TABLE public."position" OWNER TO postgres;

--
-- Name: position_positionid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.position_positionid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.position_positionid_seq OWNER TO postgres;

--
-- Name: position_positionid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.position_positionid_seq OWNED BY public."position".positionid;


--
-- Name: shift; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shift (
    shiftid integer NOT NULL,
    timestart time without time zone,
    timeend time without time zone,
    machineno integer
);


ALTER TABLE public.shift OWNER TO postgres;

--
-- Name: shift_shiftid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shift_shiftid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shift_shiftid_seq OWNER TO postgres;

--
-- Name: shift_shiftid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shift_shiftid_seq OWNED BY public.shift.shiftid;


--
-- Name: userlogs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.userlogs (
    userlogid integer NOT NULL,
    useraction text NOT NULL,
    description text,
    dateofaction timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    userid integer NOT NULL
);


ALTER TABLE public.userlogs OWNER TO postgres;

--
-- Name: userlogs_userlogid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.userlogs_userlogid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.userlogs_userlogid_seq OWNER TO postgres;

--
-- Name: userlogs_userlogid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.userlogs_userlogid_seq OWNED BY public.userlogs.userlogid;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    userid integer NOT NULL,
    username text NOT NULL,
    password character varying(255) NOT NULL,
    createddate timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    userimage bytea
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_userid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_userid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_userid_seq OWNER TO postgres;

--
-- Name: users_userid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_userid_seq OWNED BY public.users.userid;


--
-- Name: applicant applicantid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant ALTER COLUMN applicantid SET DEFAULT nextval('public.applicant_applicantid_seq'::regclass);


--
-- Name: attendance attendanceid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance ALTER COLUMN attendanceid SET DEFAULT nextval('public.attendance_attendanceid_seq'::regclass);


--
-- Name: department departmentid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department ALTER COLUMN departmentid SET DEFAULT nextval('public.department_departmentid_seq'::regclass);


--
-- Name: document documentid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document ALTER COLUMN documentid SET DEFAULT nextval('public.document_documentid_seq'::regclass);


--
-- Name: employee employeeid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee ALTER COLUMN employeeid SET DEFAULT nextval('public.employee_employeeid_seq'::regclass);


--
-- Name: inventory itemid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory ALTER COLUMN itemid SET DEFAULT nextval('public.inventory_itemid_seq'::regclass);


--
-- Name: inventorylogs logid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventorylogs ALTER COLUMN logid SET DEFAULT nextval('public.inventorylogs_logid_seq'::regclass);


--
-- Name: leave leaveid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave ALTER COLUMN leaveid SET DEFAULT nextval('public.leave_leaveid_seq'::regclass);


--
-- Name: position positionid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position" ALTER COLUMN positionid SET DEFAULT nextval('public.position_positionid_seq'::regclass);


--
-- Name: shift shiftid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift ALTER COLUMN shiftid SET DEFAULT nextval('public.shift_shiftid_seq'::regclass);


--
-- Name: userlogs userlogid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userlogs ALTER COLUMN userlogid SET DEFAULT nextval('public.userlogs_userlogid_seq'::regclass);


--
-- Name: users userid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN userid SET DEFAULT nextval('public.users_userid_seq'::regclass);


--
-- Data for Name: applicant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.applicant (applicantid, firstname, middlename, lastname, department, "position", contact, address, email, sss_number, pagibig_number, philhealth_number, bir_number, status) FROM stdin;
\.


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance (attendanceid, date, employeeid, timein, timeout) FROM stdin;
\.


--
-- Data for Name: department; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.department (departmentid, departmentname) FROM stdin;
\.


--
-- Data for Name: document; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document (documentid, type, title, uploaddate, employeeid) FROM stdin;
\.


--
-- Data for Name: employee; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.employee (employeeid, firstname, middlename, lastname, department, "position", contact, address, email, hiredate, sss_number, pagibig_number, philhealth_number, bir_number, leavecredit, departmentid, positionid, shiftid, applicantid, type, employeeimage) FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory (itemid, itemname, quantity) FROM stdin;
\.


--
-- Data for Name: inventorylogs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventorylogs (logid, itemid, employeeid, quantity, date) FROM stdin;
\.


--
-- Data for Name: leave; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave (leaveid, date, employeeid) FROM stdin;
\.


--
-- Data for Name: position; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."position" (positionid, positionname, departmentid) FROM stdin;
\.


--
-- Data for Name: shift; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shift (shiftid, timestart, timeend, machineno) FROM stdin;
\.


--
-- Data for Name: userlogs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.userlogs (userlogid, useraction, description, dateofaction, userid) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (userid, username, password, createddate, userimage) FROM stdin;
\.


--
-- Name: applicant_applicantid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.applicant_applicantid_seq', 1, false);


--
-- Name: attendance_attendanceid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_attendanceid_seq', 1, false);


--
-- Name: department_departmentid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.department_departmentid_seq', 1, false);


--
-- Name: document_documentid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.document_documentid_seq', 1, false);


--
-- Name: employee_employeeid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.employee_employeeid_seq', 1, false);


--
-- Name: inventory_itemid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventory_itemid_seq', 1, false);


--
-- Name: inventorylogs_logid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.inventorylogs_logid_seq', 1, false);


--
-- Name: leave_leaveid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_leaveid_seq', 1, false);


--
-- Name: position_positionid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.position_positionid_seq', 1, false);


--
-- Name: shift_shiftid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shift_shiftid_seq', 1, false);


--
-- Name: userlogs_userlogid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.userlogs_userlogid_seq', 1, false);


--
-- Name: users_userid_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_userid_seq', 1, false);


--
-- Name: applicant applicant_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant
    ADD CONSTRAINT applicant_email_key UNIQUE (email);


--
-- Name: applicant applicant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.applicant
    ADD CONSTRAINT applicant_pkey PRIMARY KEY (applicantid);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (attendanceid);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (departmentid);


--
-- Name: document document_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_pkey PRIMARY KEY (documentid);


--
-- Name: employee employee_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_email_key UNIQUE (email);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (employeeid);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (itemid);


--
-- Name: inventorylogs inventorylogs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventorylogs
    ADD CONSTRAINT inventorylogs_pkey PRIMARY KEY (logid);


--
-- Name: leave leave_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave
    ADD CONSTRAINT leave_pkey PRIMARY KEY (leaveid);


--
-- Name: position position_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_pkey PRIMARY KEY (positionid);


--
-- Name: shift shift_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shift
    ADD CONSTRAINT shift_pkey PRIMARY KEY (shiftid);


--
-- Name: userlogs userlogs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userlogs
    ADD CONSTRAINT userlogs_pkey PRIMARY KEY (userlogid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (userid);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: attendance attendance_employeeid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employeeid_fkey FOREIGN KEY (employeeid) REFERENCES public.employee(employeeid);


--
-- Name: document document_employeeid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document
    ADD CONSTRAINT document_employeeid_fkey FOREIGN KEY (employeeid) REFERENCES public.employee(employeeid);


--
-- Name: employee employee_applicantid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_applicantid_fkey FOREIGN KEY (applicantid) REFERENCES public.applicant(applicantid);


--
-- Name: employee employee_departmentid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_departmentid_fkey FOREIGN KEY (departmentid) REFERENCES public.department(departmentid);


--
-- Name: employee employee_positionid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_positionid_fkey FOREIGN KEY (positionid) REFERENCES public."position"(positionid);


--
-- Name: employee employee_shiftid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_shiftid_fkey FOREIGN KEY (shiftid) REFERENCES public.shift(shiftid);


--
-- Name: inventorylogs inventorylogs_employeeid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventorylogs
    ADD CONSTRAINT inventorylogs_employeeid_fkey FOREIGN KEY (employeeid) REFERENCES public.employee(employeeid);


--
-- Name: inventorylogs inventorylogs_itemid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventorylogs
    ADD CONSTRAINT inventorylogs_itemid_fkey FOREIGN KEY (itemid) REFERENCES public.inventory(itemid);


--
-- Name: leave leave_employeeid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave
    ADD CONSTRAINT leave_employeeid_fkey FOREIGN KEY (employeeid) REFERENCES public.employee(employeeid);


--
-- Name: position position_departmentid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."position"
    ADD CONSTRAINT position_departmentid_fkey FOREIGN KEY (departmentid) REFERENCES public.department(departmentid);


--
-- Name: userlogs userlogs_userid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.userlogs
    ADD CONSTRAINT userlogs_userid_fkey FOREIGN KEY (userid) REFERENCES public.users(userid);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

