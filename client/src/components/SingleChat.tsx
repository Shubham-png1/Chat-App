import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui/button";
import { BsArrowLeft } from "react-icons/bs";
import { getSender, getSenderFull } from "./config/ChatLogic";
import Modal from "./Modal";
import Cookies from "js-cookie";
import { Input } from "./ui/input";
import UpdateGroupChatModal from "./UpdateGroupChatModal";
import { useChatContext } from "@/context/chatContextUtils";
import { FaSpinner } from "react-icons/fa";
import axios, { AxiosError } from "axios";
import { useToast } from "./ui/use-toast";
import ChatScroll from "./ChatScroll";
import io, { Socket } from "socket.io-client";
import { IoIosSend } from "react-icons/io";
import Lootie from "react-lottie";
import animationData from "../Animation/Animation - 1708781412524.json";
interface Userobj {
  _id: string;
  email: string;
  name: string;
  pic: string;
}

interface chatObj {
  _id: string;
  chatName: string;
  isGroupChat: boolean;
  users: Userobj[];
  createdAt: string;
  updatedAt: string;
  groupAdmin: Userobj;
}

interface messageObj {
  _id: string;
  content: string;
  chat: chatObj;
  sender: Userobj;
}

interface SingleChatProps {
  fetchAgain: boolean;
  setFetchAgain: (obj: boolean) => void;
}
const SingleChat: React.FC<SingleChatProps> = ({
  fetchAgain,
  setFetchAgain,
}) => {
  const ENDPOINT = "https://chat-app-xv6u.onrender.com";
  const socket: Socket = useMemo(() => io(ENDPOINT), []);
  const [messages, setMessages] = useState<messageObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const { user, selectedChat, setSelectedChat, notification, setNotification } =
    useChatContext();
  const { toast } = useToast();
  const [socketConnected, setSocketConnected] = useState(false);
  const selectedChatCompare = useRef<chatObj | null>(null);
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const defaultOptions = {
    loop: true,
    autoplay: true,
    animationData: animationData,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  };
  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedChat) return;
      try {
        setLoading(true);
        const token = Cookies.get("token");
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };
        const response = await axios.get(
          `/api/message/${selectedChat?._id}`,
          config
        );
        setMessages(response.data);
        setLoading(false);
        socket.emit("join chat", selectedChat._id);
      } catch (err) {
        const error = err as AxiosError<Error>;
        toast({
          title: "Error during fetching messages",
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
    };
    fetchMessages();
    selectedChatCompare.current = selectedChat;
    return () => {
      socket.off("message received");
      socket.off("newMessage");
    };
  }, [selectedChat, toast, selectedChat?.users, socket]);

  useEffect(() => {
    socket.on("message recieved", (newMessageRecieved) => {
      if (
        !selectedChatCompare.current?._id || // if chat is not selected or doesn't match current chat
        selectedChatCompare.current._id !== newMessageRecieved.chat._id
      ) {
        // Notification
        if (!notification.includes(newMessageRecieved)) {
          setNotification([newMessageRecieved, ...notification]);
          setFetchAgain(!fetchAgain);
        }
      } else {
        setMessages([...messages, newMessageRecieved]);
      }
    });
  });

  const sendMessage = async () => {
    if (!selectedChat) return;
    if (newMessage) {
      // Add your logic to send the message
      socket.emit("stopTyping", selectedChat._id);
      try {
        setLoading(true);
        const token = Cookies.get("token");
        const config = {
          headers: {
            "Content-type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        };
        setNewMessage(""); // Clear the input after sending
        const response = await axios.post(
          "/api/message",
          {
            content: newMessage,
            chatId: selectedChat?._id,
          },
          config
        );
        setMessages([...messages, response.data]);
        socket.emit("newMessage", response.data);
        setLoading(false);
      } catch (err) {
        const error = err as AxiosError<Error>;
        toast({
          title: "Error during sending message",
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    socket.emit("setup", user);
    socket.on("connection", () => setSocketConnected(true));
    socket.on("typing", () => setIsTyping(true));
    socket.on("stopTyping", () => setIsTyping(false));
    return () => {
      socket.off("connection");
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, [socket, user]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && newMessage) {
      sendMessage();
    }
  };
  const typingHandler = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (!selectedChat) return;
    // Tying indicator logic
    if (!socketConnected) return;
    if (!typing) {
      setTyping(true);
      socket.emit("typing", selectedChat._id);
    }
    const lastTypingTime = new Date().getTime();
    const timerLength = 3000;
    setTimeout(() => {
      const timeNow = new Date().getTime();
      const timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stopTyping", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };
  return (
    <>
      {selectedChat ? (
        <div
          className="w-full
        flex flex-col
        justify-between border-2 border-primary rounded-lg "
        >
          <div className="flex items-baseline w-full bg-secondary rounded-t-lg pl-2 ">
            <Button className="lg:hidden" onClick={() => setSelectedChat(null)}>
              <BsArrowLeft className="font-bold" />
            </Button>
            {!selectedChat.isGroupChat ? (
              <div className="flex  w-full items-center justify-between px-4 py-2 ">
                <h1 className="w-full capitalize text-center  sm:text-left text-xl font-semibold">
                  {getSender(user, selectedChat.users)}
                </h1>
                <div>
                  <Modal user={getSenderFull(user, selectedChat.users)} />
                </div>
              </div>
            ) : (
              <div className=" flex justify-between items-center w-full px-4 py-2">
                <h1 className="text-xl text-center font-semibold">
                  {selectedChat.chatName.toUpperCase()}
                </h1>

                <UpdateGroupChatModal
                  fetchAgain={fetchAgain}
                  setFetchAgain={setFetchAgain}
                />
              </div>
            )}
          </div>
          <div className="overflow-hidden flex flex-col  justify-end rounded-lg h-full p-1">
            {/* Messages Here */}
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <FaSpinner className="animate-spin size-8 lg:size-16 " />
              </div>
            ) : (
              <ChatScroll messages={messages} />
            )}

            {/* Send Message */}
            {isTyping && (
              <div>
                <Lootie
                  options={defaultOptions}
                  height={50}
                  width={70}
                  style={{ marginTop: 15, marginBottom: 15, marginLeft: 10 }}
                />
              </div>
            )}
            <div className="flex gap-1 p-1 ">
              <div className="w-full px-1 ">
                <Input
                  className="bg-input text-popover-foreground "
                  placeholder="Enter a message..."
                  required={true}
                  onChange={typingHandler}
                  value={newMessage}
                  onKeyDown={handleKeyPress}
                />
              </div>
              <Button onClick={sendMessage}>
                <IoIosSend />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center w-full">
          <p className="text-xs ">
            To read the message,{" "}
            <span className="font-semibold">please select any chat</span>.
          </p>
        </div>
      )}
    </>
  );
};

export default SingleChat;
