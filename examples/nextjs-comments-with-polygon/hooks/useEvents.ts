import { useEffect } from "react";
import { useQueryClient } from "react-query";
import useCommentsContract, { EventType } from "./useCommentsContract";
import { Comment } from "../hooks/useCommentsContract"
import { useBlockNumber } from 'wagmi'


interface UseEventsQuery {
    topic: string;
}

const useEvents = async ({ topic }: UseEventsQuery) => {
    const queryClient = useQueryClient();
    const commentsContract = useCommentsContract();
    const [blockQuery, getBlockNumber] = useBlockNumber();

    useEffect(() => {
        const handler = (comment, event) => {
            console.log(blockQuery.data)
            if (comment.topic !== topic || (blockQuery.data && event.blockNumber <= blockQuery.data)) {
                return;
            }
            // One way
            // queryClient.invalidateQueries(["comments", { topic: comment.topic, chainId: commentsContract.chainId }]);

            //  [alternative] update comments cacha data [alternative]
            queryClient.setQueryData(["comments", { topic: comment.topic, chainId: commentsContract.chainId }], (comments: Comment[] | undefined) => {
                if (comments !== undefined) {
                    return [...comments, { ...comment }]
                }
                return [{ ...comment }]
            });
            getBlockNumber();
        }

        commentsContract.contract.on(EventType.CommentAdded, handler);
        return () => {
            commentsContract.contract.off(EventType.CommentAdded, handler);
        }
    }, [queryClient, commentsContract.contract, commentsContract.chainId, blockQuery.data, getBlockNumber, topic]);
}

export default useEvents;