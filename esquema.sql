--
-- PostgreSQL database dump
--

\restrict uROacPOXcj2AcjbdkCKNztU5iVpjR1uifGuFS3yshDfup3llL1o5yMJlH7DmsQW

-- Dumped from database version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)
-- Dumped by pg_dump version 14.19 (Ubuntu 14.19-0ubuntu0.22.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: answers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.answers (
    id integer NOT NULL,
    round_id integer,
    player_id integer,
    answer_text text NOT NULL,
    votes integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.answers OWNER TO postgres;

--
-- Name: answers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.answers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.answers_id_seq OWNER TO postgres;

--
-- Name: answers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.answers_id_seq OWNED BY public.answers.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    room_id integer,
    player_id integer,
    message text NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.chat_messages OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.chat_messages_id_seq OWNER TO postgres;

--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.players (
    id integer NOT NULL,
    room_id integer,
    socket_id character varying(255) NOT NULL,
    nickname character varying(50) NOT NULL,
    score integer DEFAULT 0,
    is_host boolean DEFAULT false,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.players OWNER TO postgres;

--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.players_id_seq OWNER TO postgres;

--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: prompts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prompts (
    id integer NOT NULL,
    prompt_text text NOT NULL,
    category character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.prompts OWNER TO postgres;

--
-- Name: prompts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.prompts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.prompts_id_seq OWNER TO postgres;

--
-- Name: prompts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.prompts_id_seq OWNED BY public.prompts.id;


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    id integer NOT NULL,
    code character varying(6) NOT NULL,
    host_id character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying,
    max_players integer DEFAULT 8,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    total_rounds integer DEFAULT 3,
    allow_self_vote boolean DEFAULT false
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rooms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rooms_id_seq OWNER TO postgres;

--
-- Name: rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rooms_id_seq OWNED BY public.rooms.id;


--
-- Name: rounds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rounds (
    id integer NOT NULL,
    room_id integer,
    round_number integer NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    prompt_id integer
);


ALTER TABLE public.rounds OWNER TO postgres;

--
-- Name: rounds_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rounds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.rounds_id_seq OWNER TO postgres;

--
-- Name: rounds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rounds_id_seq OWNED BY public.rounds.id;


--
-- Name: votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.votes (
    id integer NOT NULL,
    answer_id integer,
    player_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.votes OWNER TO postgres;

--
-- Name: votes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.votes_id_seq OWNER TO postgres;

--
-- Name: votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.votes_id_seq OWNED BY public.votes.id;


--
-- Name: answers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers ALTER COLUMN id SET DEFAULT nextval('public.answers_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: prompts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompts ALTER COLUMN id SET DEFAULT nextval('public.prompts_id_seq'::regclass);


--
-- Name: rooms id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms ALTER COLUMN id SET DEFAULT nextval('public.rooms_id_seq'::regclass);


--
-- Name: rounds id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rounds ALTER COLUMN id SET DEFAULT nextval('public.rounds_id_seq'::regclass);


--
-- Name: votes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes ALTER COLUMN id SET DEFAULT nextval('public.votes_id_seq'::regclass);


--
-- Name: answers answers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: players players_socket_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_socket_id_key UNIQUE (socket_id);


--
-- Name: prompts prompts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prompts
    ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_code_key UNIQUE (code);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: rounds rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_pkey PRIMARY KEY (id);


--
-- Name: votes votes_answer_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_answer_id_player_id_key UNIQUE (answer_id, player_id);


--
-- Name: votes votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_pkey PRIMARY KEY (id);


--
-- Name: answers answers_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: answers answers_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.answers
    ADD CONSTRAINT answers_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: players players_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: rounds rounds_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES public.prompts(id);


--
-- Name: rounds rounds_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE;


--
-- Name: votes votes_answer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_answer_id_fkey FOREIGN KEY (answer_id) REFERENCES public.answers(id) ON DELETE CASCADE;


--
-- Name: votes votes_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.votes
    ADD CONSTRAINT votes_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict uROacPOXcj2AcjbdkCKNztU5iVpjR1uifGuFS3yshDfup3llL1o5yMJlH7DmsQW

